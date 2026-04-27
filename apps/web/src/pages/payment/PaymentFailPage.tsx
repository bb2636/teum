import { useNavigate, useSearchParams } from 'react-router-dom';
import { X, AlertCircle } from 'lucide-react';
import { useHideTabBar } from '@/contexts/HideTabBarContext';
import { useEffect } from 'react';
import { useT } from '@/hooks/useTranslation';

export function PaymentFailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setHideTabBar } = useHideTabBar();
  const t = useT();
  const message = searchParams.get('message') || t('payment.fail');

  useEffect(() => {
    setHideTabBar(true);
    return () => {
      setHideTabBar(false);
    };
  }, [setHideTabBar]);

  useEffect(() => {
    if (searchParams.get('n') !== '1') return;
    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;
        sessionStorage.setItem('teum_native_payment_pending', 'fail');
        sessionStorage.setItem('teum_native_payment_message', message);
        window.location.replace(`com.teum.app://payment-result?status=fail&message=${encodeURIComponent(message)}`);
      } catch {}
    })();
  }, [searchParams, message]);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex justify-end p-4">
        <button
          onClick={() => navigate('/home')}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5 text-[#4A2C1A]" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-black mb-3">{t('payment.fail.title')}</h1>
        <p className="text-base text-gray-500 text-center leading-relaxed">{message}</p>
      </div>

      <div className="p-6 pb-safe-fixed space-y-3">
        <button
          onClick={() => navigate('/payment', { replace: true })}
          className="w-full py-4 px-4 rounded-full bg-[#4A2C1A] hover:bg-[#3A2010] text-white font-medium transition-colors"
        >
          {t('payment.fail.retry')}
        </button>
        <button
          onClick={() => navigate('/home')}
          className="w-full py-4 px-4 rounded-full border border-gray-200 text-[#4A2C1A] font-medium transition-colors hover:bg-gray-50"
        >
          {t('common.goHome')}
        </button>
      </div>
    </div>
  );
}
