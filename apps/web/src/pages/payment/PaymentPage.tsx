import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, BookOpen, FileText, Headphones, X, CreditCard, Globe } from 'lucide-react';
import { useInitBillingKey, useInitPayPal, usePlanPrice, useNeedsVerification } from '@/hooks/usePayment';
import { PaymentTermsSheet } from '@/components/PaymentTermsSheet';
import { useHideTabBar } from '@/contexts/HideTabBarContext';
import { useT } from '@/hooks/useTranslation';
import { getCurrentLanguage } from '@/lib/i18n';
import { useRequestPhoneVerification, useConfirmPhoneVerification } from '@/hooks/usePhoneVerification';
import { countryCodes } from '@/lib/countryCodes';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { useAppleIAP } from '@/hooks/useAppleIAP';

function applyNicepaySafeArea(el: HTMLElement) {
  const cs = window.getComputedStyle(el);
  if (cs.position === 'fixed' && Number(cs.zIndex) > 1000) {
    el.style.setProperty('padding-top', 'env(safe-area-inset-top, 0px)', 'important');
    el.style.setProperty('padding-bottom', 'env(safe-area-inset-bottom, 0px)', 'important');
    el.style.setProperty('box-sizing', 'border-box', 'important');
    el.querySelectorAll('iframe').forEach((iframe) => {
      iframe.style.setProperty('height', '100%', 'important');
    });
  }
}

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

type PaymentMethodType = 'nicepay' | 'paypal' | 'apple';

export function PaymentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setHideTabBar } = useHideTabBar();
  const t = useT();
  const planName = searchParams.get('plan') || t('payment.plan');
  const { data: planPrice } = usePlanPrice();
  const { data: needsVerificationData, isLoading: isVerificationLoading } = useNeedsVerification();
  const isKorean = getCurrentLanguage() === 'ko';
  const displayAmount = isKorean ? (planPrice?.krw ?? 5800) : planPrice?.usd ?? 3.99;
  const displayAmountFormatted = isKorean ? displayAmount.toLocaleString() : (displayAmount as number).toFixed(2);

  useEffect(() => {
    setHideTabBar(true);
    return () => {
      setHideTabBar(false);
    };
  }, [setHideTabBar]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            applyNicepaySafeArea(node as HTMLElement);
          }
        });
      });
    });
    observer.observe(document.body, { childList: true });
    return () => observer.disconnect();
  }, []);

  const appleIAP = useAppleIAP();
  const defaultMethod: PaymentMethodType = appleIAP.available
    ? 'apple'
    : isKorean
      ? 'nicepay'
      : 'paypal';
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>(defaultMethod);
  const [cardCode, setCardCode] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTermsSheet, setShowTermsSheet] = useState(false);

  const [identityVerified, setIdentityVerified] = useState(false);
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [identityPhone, setIdentityPhone] = useState('');
  const [identityCode, setIdentityCode] = useState('');
  const [identityCodeSent, setIdentityCodeSent] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [selectedCountryCode, setSelectedCountryCode] = useState(countryCodes[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

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

  const isButtonEnabled =
    paymentMethod === 'paypal' ||
    (paymentMethod === 'apple' && appleIAP.ready) ||
    !!cardCode;

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
      if (isVerificationLoading) {
        return;
      }
      if (needsVerificationData && !identityVerified) {
        setShowIdentityModal(true);
        return;
      }
      if (paymentMethod === 'paypal') {
        handleStartPayPal();
      } else if (paymentMethod === 'apple') {
        handleStartApple();
      } else {
        handleStartBillingRegistration();
      }
    }
  };

  const handleStartApple = async () => {
    try {
      await appleIAP.purchase();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : t('payment.initError'));
    }
  };

  useEffect(() => {
    if (appleIAP.error) {
      alert(appleIAP.error);
    }
  }, [appleIAP.error]);

  const handleStartPayPal = async () => {
    setIsProcessing(true);
    try {
      const result = await initPayPal.mutateAsync();
      if (Capacitor.isNativePlatform()) {
        await Browser.open({ url: result.approveUrl, windowName: '_self' });
        const listener = await Browser.addListener('browserFinished', () => {
          setIsProcessing(false);
          listener.remove();
        });
      } else {
        window.location.href = result.approveUrl;
      }
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : t('payment.initError'));
      setIsProcessing(false);
    }
  };

  const handleStartBillingRegistration = async () => {
    setIsProcessing(true);

    try {
      const initResult = await initBillingKey.mutateAsync({
        planName,
        paymentMethod: 'CARD',
        identityVerified,
      });

      if (!window.AUTHNICE) {
        alert(t('payment.nicepayLoadFailed'));
        setIsProcessing(false);
        return;
      }

      const isNative = Capacitor.isNativePlatform();

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

      const originalFnError = payParams.fnError;
      payParams.fnError = (result: { errorMsg?: string; resultCode?: string; resultMsg?: string }) => {
        console.error('[NicePay] requestPay error', {
          cardCode,
          isNative,
          resultCode: result?.resultCode,
          resultMsg: result?.resultMsg,
          errorMsg: result?.errorMsg,
        });
        if (typeof originalFnError === 'function') {
          (originalFnError as (r: typeof result) => void)(result);
        }
      };

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
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : t('payment.initError'));
      setIsProcessing(false);
    }
  };

  const handleSendIdentityCode = async () => {
    if (!identityPhone || identityPhone.length < 4) return;
    setIdentityError(null);
    try {
      await requestPhoneVerification.mutateAsync({ phone: identityPhone, countryCode: selectedCountryCode.dial });
      setIdentityCodeSent(true);
    } catch (err: unknown) {
      setIdentityError(err instanceof Error ? err.message : t('auth.verificationFailed'));
    }
  };

  const handleConfirmIdentityCode = async () => {
    if (!identityPhone || !identityCode) return;
    setIdentityError(null);
    try {
      await confirmPhoneVerification.mutateAsync({ phone: identityPhone, countryCode: selectedCountryCode.dial, code: identityCode });
      setIdentityVerified(true);
      setShowIdentityModal(false);
      setIdentityCode('');
      if (paymentMethod === 'paypal') {
        handleStartPayPal();
      } else if (paymentMethod === 'apple') {
        handleStartApple();
      } else {
        handleStartBillingRegistration();
      }
    } catch (err: unknown) {
      setIdentityError(err instanceof Error ? err.message : t('auth.verificationInvalid'));
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
                <div className="text-right">
                  <span className="text-base font-bold text-[#4A2C1A]">
                    ${(planPrice?.usd ?? 3.99).toFixed(2)}
                  </span>
                  {isKorean && paymentMethod === 'nicepay' && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      ({displayAmountFormatted}{t('payment.won')} - {t('payment.autoExchangeRate')})
                    </p>
                  )}
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-600 mt-3">
              {t('payment.autoRenewalNote')}
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-[#4A2C1A] mb-4">{t('payment.method')}</h2>

            <div className="space-y-3 mb-4">
              {appleIAP.available && (
                <button
                  onClick={() => setPaymentMethod('apple')}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                    paymentMethod === 'apple'
                      ? 'border-[#4A2C1A] bg-[#4A2C1A]/5'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    paymentMethod === 'apple' ? 'border-[#4A2C1A]' : 'border-gray-300'
                  }`}>
                    {paymentMethod === 'apple' && <div className="w-2.5 h-2.5 rounded-full bg-[#4A2C1A]" />}
                  </div>
                  <CreditCard className="w-5 h-5 text-[#4A2C1A]" />
                  <div className="flex-1 text-left">
                    <p className="font-medium text-[#4A2C1A]">App Store</p>
                    <p className="text-xs text-gray-500">
                      {appleIAP.product?.price || (appleIAP.ready ? 'Apple ID' : '불러오는 중...')}
                    </p>
                  </div>
                </button>
              )}
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
              {paymentMethod === 'paypal'
                ? t('payment.paypalNote')
                : paymentMethod === 'apple'
                  ? t('payment.appStoreNote')
                  : t('payment.paymentNote')}
            </p>
            <button
              onClick={handlePaymentClick}
              disabled={isProcessing || initBillingKey.isPending || initPayPal.isPending || appleIAP.purchasing || !isButtonEnabled}
              className="w-full py-4 px-4 rounded-full bg-[#4A2C1A] hover:bg-[#3A2010] text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing || initBillingKey.isPending || initPayPal.isPending || appleIAP.purchasing
                ? t('payment.processing')
                : paymentMethod === 'apple'
                  ? `App Store ${appleIAP.product?.price || ''}`.trim()
                  : paymentMethod === 'paypal'
                    ? t('payment.payWithPayPal', { amount: (planPrice?.usd ?? 3.99).toFixed(2) })
                    : isKorean
                      ? t('payment.startMonthly', { amount: displayAmountFormatted })
                      : `Start at $${(planPrice?.usd ?? 3.99).toFixed(2)}/month`}
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
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => { if (!identityCodeSent) { setShowCountryPicker(true); setCountrySearch(''); } }}
                  disabled={identityCodeSent}
                  className="flex items-center gap-1 px-2 h-10 border border-gray-300 rounded-md text-sm whitespace-nowrap shrink-0 hover:bg-gray-50 disabled:opacity-50"
                >
                  <span>{selectedCountryCode.flag}</span>
                  <span className="text-gray-700">{selectedCountryCode.dial}</span>
                  <ChevronDown className="w-3 h-3 text-gray-400" />
                </button>
                <div className="relative flex-1">
                  <Input
                    id="identityPhone"
                    type="tel"
                    value={identityPhone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 15);
                      setIdentityPhone(val);
                      if (identityCodeSent) {
                        setIdentityCodeSent(false);
                        setIdentityCode('');
                      }
                    }}
                    placeholder={t('payment.enterPhone')}
                    className="pr-24"
                    disabled={identityCodeSent}
                    maxLength={15}
                    inputMode="numeric"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleSendIdentityCode}
                    disabled={requestPhoneVerification.isPending || identityCodeSent || identityPhone.length < 4}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700"
                  >
                    {identityCodeSent ? t('auth.verificationComplete') : requestPhoneVerification.isPending ? t('auth.sending') : t('auth.sendVerificationCode')}
                  </Button>
                </div>
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

      {showCountryPicker && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 flex items-end justify-center animate-overlay-fade"
          onClick={() => setShowCountryPicker(false)}
        >
          <div
            className="bg-white rounded-t-2xl w-full max-w-sm animate-modal-pop"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: '70vh' }}
          >
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">{getCurrentLanguage() === 'ko' ? '국가 선택' : 'Select Country'}</h2>
                <button onClick={() => setShowCountryPicker(false)} className="p-2 rounded-full hover:bg-gray-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <Input
                type="text"
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
                placeholder={getCurrentLanguage() === 'ko' ? '국가 검색...' : 'Search country...'}
                className="text-sm"
                autoFocus
              />
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 120px)' }}>
              {countryCodes
                .filter((c) => {
                  if (!countrySearch) return true;
                  const q = countrySearch.toLowerCase();
                  return c.name.toLowerCase().includes(q) || c.nameEn.toLowerCase().includes(q) || c.dial.includes(q) || c.code.toLowerCase().includes(q);
                })
                .map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => {
                      setSelectedCountryCode(c);
                      setShowCountryPicker(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left ${
                      selectedCountryCode.code === c.code ? 'bg-[#f6efed]' : ''
                    }`}
                  >
                    <span className="text-xl">{c.flag}</span>
                    <span className="flex-1 text-sm text-gray-800">
                      {getCurrentLanguage() === 'ko' ? c.name : c.nameEn}
                    </span>
                    <span className="text-sm text-gray-500">{c.dial}</span>
                  </button>
                ))}
            </div>
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
