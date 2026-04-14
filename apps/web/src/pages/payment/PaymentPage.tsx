import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, BookOpen, FileText, Headphones, X, CreditCard, Globe } from 'lucide-react';
import { useInitBillingKey, useInitPayPal, usePlanPrice } from '@/hooks/usePayment';
import { PaymentTermsSheet } from '@/components/PaymentTermsSheet';
import { useHideTabBar } from '@/contexts/HideTabBarContext';
import { useT } from '@/hooks/useTranslation';
import { getCurrentLanguage } from '@/lib/i18n';
import { useRequestPhoneVerification, useConfirmPhoneVerification } from '@/hooks/usePhoneVerification';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

declare global {
  interface Window {
    AUTHNICE?: {
      requestPay: (params: Record<string, unknown>) => void;
    };
  }
}

const NICEPAY_CARD_COMPANIES = [
  { code: '06', name: '신한카드' },
  { code: '02', name: 'KB국민카드' },
  { code: '03', name: '하나카드' },
  { code: '04', name: '삼성카드' },
  { code: '07', name: '현대카드' },
  { code: '08', name: '롯데카드' },
  { code: '12', name: 'NH농협카드' },
  { code: '01', name: 'BC카드' },
  { code: '15', name: '우리카드' },
  { code: '11', name: '씨티카드' },
];

type PaymentMethodType = 'nicepay' | 'paypal';

export function PaymentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setHideTabBar } = useHideTabBar();
  const t = useT();
  const planName = searchParams.get('plan') || t('payment.plan');
  const { data: planPrice } = usePlanPrice();
  const isKorean = getCurrentLanguage() === 'ko';
  const displayAmount = isKorean ? (planPrice?.krw ?? 5800) : planPrice?.usd ?? 3.99;
  const displayAmountFormatted = isKorean ? displayAmount.toLocaleString() : (displayAmount as number).toFixed(2);

  useEffect(() => {
    setHideTabBar(true);
    return () => {
      setHideTabBar(false);
    };
  }, [setHideTabBar]);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>(isKorean ? 'nicepay' : 'paypal');
  const [cardCode, setCardCode] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTermsSheet, setShowTermsSheet] = useState(false);

  const [identityVerified, setIdentityVerified] = useState(false);
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [identityPhone, setIdentityPhone] = useState('');
  const [identityCode, setIdentityCode] = useState('');
  const [identityCodeSent, setIdentityCodeSent] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);

  const requestPhoneVerification = useRequestPhoneVerification();
  const confirmPhoneVerification = useConfirmPhoneVerification();

  const initBillingKey = useInitBillingKey();
  const initPayPal = useInitPayPal();

  const nextPaymentDate = useMemo(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}.${m}.${d}`;
  }, []);

  const isButtonEnabled = paymentMethod === 'paypal' || !!cardCode;

  const handlePaymentClick = () => {
    if (paymentMethod === 'nicepay' && !cardCode) {
      alert(t('payment.selectCardCompany'));
      return;
    }
    setShowTermsSheet(true);
  };

  const handleTermsAgreed = (agreed: boolean) => {
    if (agreed) {
      setShowTermsSheet(false);
      if (paymentMethod === 'paypal') {
        handleStartPayPal();
      } else {
        if (!identityVerified) {
          setShowIdentityModal(true);
        } else {
          handleStartBillingRegistration();
        }
      }
    }
  };

  const handleStartPayPal = async () => {
    setIsProcessing(true);
    try {
      const result = await initPayPal.mutateAsync();
      window.location.href = result.approveUrl;
    } catch (error: any) {
      console.error('PayPal init error:', error);
      alert(error?.message || t('payment.initError'));
      setIsProcessing(false);
    }
  };

  const handleStartBillingRegistration = async () => {
    setIsProcessing(true);

    try {
      const initResult = await initBillingKey.mutateAsync({
        planName,
        paymentMethod: 'CARD',
        identityVerified: true,
      });

      if (!window.AUTHNICE) {
        alert(t('payment.nicepayLoadFailed'));
        setIsProcessing(false);
        return;
      }

      const capacitor = (window as any).Capacitor;
      const isNative = !!capacitor?.isNativePlatform?.();

      const payParams: Record<string, unknown> = {
        clientId: initResult.clientId,
        method: 'card',
        orderId: initResult.orderId,
        amount: initResult.amount,
        goodsName: planName,
        returnUrl: initResult.returnUrl,
        subscYn: 'Y',
        fnError: (result: { errorMsg?: string }) => {
          setIsProcessing(false);
          alert(result.errorMsg || t('payment.paymentError'));
        },
      };

      if (cardCode) {
        payParams.cardCode = cardCode;
      }

      if (isNative) {
        payParams.appScheme = 'com.teum.app';
      }

      window.AUTHNICE.requestPay(payParams);

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          setTimeout(() => {
            setIsProcessing(false);
          }, 3000);
          document.removeEventListener('visibilitychange', handleVisibilityChange);
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
    } catch (error: any) {
      console.error('Billing key init error:', error);
      alert(error?.message || t('payment.initError'));
      setIsProcessing(false);
    }
  };

  const handleSendIdentityCode = async () => {
    if (!identityPhone || identityPhone.length < 10) return;
    setIdentityError(null);
    try {
      await requestPhoneVerification.mutateAsync(identityPhone);
      setIdentityCodeSent(true);
    } catch (err: any) {
      setIdentityError(err?.message || t('auth.verificationFailed'));
    }
  };

  const handleConfirmIdentityCode = async () => {
    if (!identityPhone || !identityCode) return;
    setIdentityError(null);
    try {
      await confirmPhoneVerification.mutateAsync({ phone: identityPhone, code: identityCode });
      setIdentityVerified(true);
      setShowIdentityModal(false);
      setIdentityCode('');
      handleStartBillingRegistration();
    } catch (err: any) {
      setIdentityError(err?.message || t('auth.verificationInvalid'));
    }
  };

  return (
    <div className="min-h-screen bg-white pb-32">
      <div className="max-w-md mx-auto">
        <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between" style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 12px))' }}>
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[#4A2C1A]" />
          </button>
          <h1 className="text-lg font-semibold text-[#4A2C1A]">{t('payment.subscriptionPayment')}</h1>
          <div className="w-10" />
        </div>

        <div className="px-4 py-6 space-y-6">
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-700">{t('payment.planBenefits')}</span>
              <div className="flex items-center gap-2">
                <img
                  src="/mureka_logo.png"
                  alt="Mureka"
                  className="h-3 w-auto mureka-logo"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-[#4A2C1A] mb-1">
                    {t('payment.unlimitedDiary')}
                  </h3>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-[#4A2C1A] mb-1">
                    {t('payment.aiLyrics')}
                  </h3>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Headphones className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-[#4A2C1A] mb-1">
                    {t('payment.musicGeneration')}
                  </h3>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-[#4A2C1A]">{t('payment.paymentInfo')}</h2>
              <span className="text-sm text-gray-600">{t('payment.nextPaymentDateLabel', { date: nextPaymentDate })}</span>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{t('payment.plan')}</span>
                <span className="text-sm font-medium text-[#4A2C1A]">{planName}</span>
              </div>
              <div className="border-t border-gray-200"></div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{t('payment.amount')}</span>
                <span className="text-base font-bold text-[#4A2C1A]">
                  {paymentMethod === 'paypal'
                    ? `$${(planPrice?.usd ?? 3.99).toFixed(2)}`
                    : isKorean
                      ? `${displayAmountFormatted}${t('payment.won')}`
                      : `$${displayAmountFormatted}`
                  }
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-600 mt-3">
              {t('payment.autoRenewalNote')}
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-[#4A2C1A] mb-4">{t('payment.method')}</h2>

            <div className="space-y-3 mb-4">
              <button
                onClick={() => setPaymentMethod('nicepay')}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  paymentMethod === 'nicepay'
                    ? 'border-[#4A2C1A] bg-[#4A2C1A]/5'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  paymentMethod === 'nicepay' ? 'border-[#4A2C1A]' : 'border-gray-300'
                }`}>
                  {paymentMethod === 'nicepay' && <div className="w-2.5 h-2.5 rounded-full bg-[#4A2C1A]" />}
                </div>
                <CreditCard className="w-5 h-5 text-[#4A2C1A]" />
                <div className="flex-1 text-left">
                  <p className="font-medium text-[#4A2C1A]">{t('payment.creditDebitCard')}</p>
                  <p className="text-xs text-gray-500">{t('payment.koreanCards')}</p>
                </div>
              </button>

              <button
                onClick={() => setPaymentMethod('paypal')}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  paymentMethod === 'paypal'
                    ? 'border-[#4A2C1A] bg-[#4A2C1A]/5'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  paymentMethod === 'paypal' ? 'border-[#4A2C1A]' : 'border-gray-300'
                }`}>
                  {paymentMethod === 'paypal' && <div className="w-2.5 h-2.5 rounded-full bg-[#4A2C1A]" />}
                </div>
                <Globe className="w-5 h-5 text-[#003087]" />
                <div className="flex-1 text-left">
                  <p className="font-medium text-[#4A2C1A]">PayPal</p>
                  <p className="text-xs text-gray-500">USD ${ (planPrice?.usd ?? 3.99).toFixed(2) }</p>
                </div>
              </button>
            </div>

            {paymentMethod === 'nicepay' && (
              <div className="space-y-3">
                <div className="relative">
                  <div className="bg-gray-50 rounded-lg px-3 py-2 flex items-center justify-between pointer-events-none">
                    <span className="text-sm text-gray-600">
                      {NICEPAY_CARD_COMPANIES.find(c => c.code === cardCode)?.name || t('payment.selectCard')}
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </div>
                  <select
                    value={cardCode}
                    onChange={(e) => setCardCode(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  >
                    <option value="">{t('payment.selectCard')}</option>
                    {NICEPAY_CARD_COMPANIES.map((card) => (
                      <option key={card.code} value={card.code}>
                        {card.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 pb-safe-fixed">
          <div className="max-w-md mx-auto">
            <p className="text-xs text-gray-600 text-center mb-3">
              {paymentMethod === 'paypal' ? t('payment.paypalNote') : t('payment.paymentNote')}
            </p>
            <button
              onClick={handlePaymentClick}
              disabled={isProcessing || initBillingKey.isPending || initPayPal.isPending || !isButtonEnabled}
              className="w-full py-4 px-4 rounded-full bg-[#4A2C1A] hover:bg-[#3A2010] text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing || initBillingKey.isPending || initPayPal.isPending
                ? t('payment.processing')
                : paymentMethod === 'paypal'
                  ? t('payment.payWithPayPal', { amount: (planPrice?.usd ?? 3.99).toFixed(2) })
                  : t('payment.startMonthly', { amount: displayAmountFormatted })}
            </button>
          </div>
        </div>
      </div>

      {showIdentityModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center animate-overlay-fade px-4" onClick={() => setShowIdentityModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 animate-modal-pop" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('payment.identityVerification')}</h2>
              <button onClick={() => setShowIdentityModal(false)} className="p-2 rounded-full hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500">{t('payment.identityVerificationDesc')}</p>

            {identityError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{identityError}</div>
            )}

            <div className="space-y-2">
              <Label htmlFor="identityPhone">{t('auth.phone')}</Label>
              <div className="relative">
                <Input
                  id="identityPhone"
                  type="tel"
                  value={identityPhone}
                  onChange={(e) => {
                    setIdentityPhone(e.target.value);
                    if (identityCodeSent) {
                      setIdentityCodeSent(false);
                      setIdentityCode('');
                    }
                  }}
                  placeholder={t('payment.enterPhone')}
                  className="pr-28"
                  disabled={identityCodeSent}
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleSendIdentityCode}
                  disabled={requestPhoneVerification.isPending || identityCodeSent || identityPhone.length < 10}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 px-3 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700"
                >
                  {identityCodeSent ? t('auth.verificationComplete') : requestPhoneVerification.isPending ? t('auth.sending') : t('auth.sendVerificationCode')}
                </Button>
              </div>
            </div>

            {identityCodeSent && (
              <div className="space-y-2">
                <Label htmlFor="identityCode">{t('auth.verificationCode')}</Label>
                <Input
                  id="identityCode"
                  type="text"
                  value={identityCode}
                  onChange={(e) => setIdentityCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder={t('auth.enterVerificationCode')}
                  maxLength={6}
                  className="text-center text-lg tracking-widest focus:placeholder-transparent"
                />
              </div>
            )}

            {identityCodeSent && (
              <Button
                onClick={handleConfirmIdentityCode}
                className="w-full bg-[#4A2C1A] hover:bg-[#3A2010] text-white"
                disabled={identityCode.length !== 6 || confirmPhoneVerification.isPending}
              >
                {confirmPhoneVerification.isPending ? t('auth.verifying') : t('common.confirm')}
              </Button>
            )}
          </div>
        </div>
      )}

      <PaymentTermsSheet
        isOpen={showTermsSheet}
        onClose={() => setShowTermsSheet(false)}
        onAgree={handleTermsAgreed}
      />
    </div>
  );
}
