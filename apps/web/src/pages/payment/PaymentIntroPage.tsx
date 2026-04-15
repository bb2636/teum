import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, BookOpen, FileText, Headphones } from 'lucide-react';
import { useHideTabBar } from '@/contexts/HideTabBarContext';
import { useEffect } from 'react';
import { SubscriptionStartModal } from '@/components/SubscriptionStartModal';
import { useT } from '@/hooks/useTranslation';
import { getCurrentLanguage } from '@/lib/i18n';
import { usePlanPrice } from '@/hooks/usePayment';

export function PaymentIntroPage() {
  const navigate = useNavigate();
  const { setHideTabBar } = useHideTabBar();
  const [showStartModal, setShowStartModal] = useState(false);
  const t = useT();
  const isKorean = getCurrentLanguage() === 'ko';
  const { data: planPrice } = usePlanPrice();
  const krwAmount = planPrice?.krw ?? 5800;
  const displayAmount = isKorean ? krwAmount : 399;
  const displayAmountFormatted = isKorean ? krwAmount.toLocaleString() : '3.99';
  const usdPrice = `$${(planPrice?.usd ?? 3.99).toFixed(2)}`;

  useEffect(() => {
    setHideTabBar(true);
    return () => {
      setHideTabBar(false);
    };
  }, [setHideTabBar]);

  const handleStartClick = () => {
    setShowStartModal(true);
  };

  const handleConfirmStart = () => {
    setShowStartModal(false);
    navigate(`/payment/checkout?plan=${encodeURIComponent(t('payment.musicPlanMonthly'))}`);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-md mx-auto">
        <div className="sticky top-0 z-30 flex justify-end p-4 bg-white" style={{ paddingTop: 'max(16px, env(safe-area-inset-top, 16px))' }}>
          <button
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/');
              }
            }}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-[#4A2C1A]" />
          </button>
        </div>

        <div className="px-4 mb-6">
          <div className="flex items-center gap-2">
            <img
              src="/mureka_logo.png"
              alt="Mureka"
              className="h-4 w-auto mureka-logo"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        </div>

        <div className="px-4 mb-8">
          <h1 className="text-2xl font-bold text-black mb-2">
            {t('payment.intro.headline')}
          </h1>
          <p className="text-base text-gray-600">
            {t('payment.intro.subhead')}
          </p>
        </div>

        <div className="px-4 mb-8">
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

          <div className="bg-gray-50 rounded-xl p-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-5 h-5 text-gray-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-[#4A2C1A] mb-1">
                  {t('payment.unlimitedDiary')}
                </h3>
                <p className="text-sm text-gray-600">
                  {t('payment.intro.benefit1Desc')}
                </p>
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
                <p className="text-sm text-gray-600">
                  {t('payment.intro.benefit2Desc')}
                </p>
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
                <p className="text-sm text-gray-600">
                  {t('payment.intro.benefit3Desc')}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 rounded-t-3xl shadow-lg pb-safe-fixed">
          <div className="max-w-md mx-auto px-4 py-6">
            <div className="mb-4">
              <div className="text-3xl font-bold text-black mb-1">{usdPrice}</div>
              <div className="text-sm text-gray-600">{t('payment.intro.monthlyAuto')}</div>
              {isKorean && (
                <div className="text-xs text-gray-400 mt-1">
                  ({krwAmount.toLocaleString()}{t('payment.won')} - {t('payment.autoExchangeRate')})
                </div>
              )}
            </div>
            <button
              onClick={handleStartClick}
              className="w-full py-4 px-4 rounded-full bg-[#4A2C1A] hover:bg-[#3A2010] text-white font-medium transition-colors"
            >
              {isKorean
                ? t('payment.startMonthly', { amount: displayAmountFormatted })
                : `Start at ${usdPrice}/month`}
            </button>
          </div>
        </div>
      </div>

      <SubscriptionStartModal
        isOpen={showStartModal}
        onClose={() => setShowStartModal(false)}
        onConfirm={handleConfirmStart}
        amount={displayAmount}
      />
    </div>
  );
}
