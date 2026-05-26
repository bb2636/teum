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
    // ⚠️ 이 페이지는 PayPal/NicePay 콜백 후 외부 브라우저(Custom Tab) 안에서
    // 로드된다. Custom Tab 안에서는 Capacitor 가 주입되지 않아
    // `Capacitor.isNativePlatform()` 가 false 를 반환하므로 가드해서는 안 된다.
    // ?n=1 은 "외부 브라우저에서 호출됐으니 deep-link 로 앱에 복귀시켜라" 라는
    // 명시적 플래그이므로, 이 시점에는 무조건 com.teum.app:// 를 트리거한다.
    try {
      sessionStorage.setItem('teum_native_payment_pending', 'fail');
      sessionStorage.setItem('teum_native_payment_message', message);
    } catch {}
    window.location.replace(`com.teum.app://payment-result?status=fail&message=${encodeURIComponent(message)}`);
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

      <div
        className="px-6 pt-6 space-y-3"
        style={{
          // Android 의 제스처 네비바/3버튼 네비바에 버튼이 묻히지 않도록
          // env() safe-area 가 0 으로 잡히는 환경에서도 최소 24px 여백 보장.
          paddingBottom: 'max(24px, calc(env(safe-area-inset-bottom, 0px) + 24px))',
        }}
      >
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
