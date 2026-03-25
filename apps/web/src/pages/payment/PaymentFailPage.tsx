import { useNavigate, useSearchParams } from 'react-router-dom';
import { X, AlertCircle } from 'lucide-react';
import { useHideTabBar } from '@/contexts/HideTabBarContext';
import { useEffect } from 'react';

export function PaymentFailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setHideTabBar } = useHideTabBar();
  const message = searchParams.get('message') || '결제에 실패했습니다.';

  useEffect(() => {
    setHideTabBar(true);
    return () => {
      setHideTabBar(false);
    };
  }, [setHideTabBar]);

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
        <h1 className="text-2xl font-bold text-black mb-3">결제 실패</h1>
        <p className="text-base text-gray-500 text-center leading-relaxed">{message}</p>
      </div>

      <div className="p-6 space-y-3">
        <button
          onClick={() => navigate(-1)}
          className="w-full py-4 px-4 rounded-full bg-[#665146] hover:bg-[#5A453A] text-white font-medium transition-colors"
        >
          다시 시도하기
        </button>
        <button
          onClick={() => navigate('/home')}
          className="w-full py-4 px-4 rounded-full border border-gray-200 text-[#4A2C1A] font-medium transition-colors hover:bg-gray-50"
        >
          홈으로 돌아가기
        </button>
      </div>
    </div>
  );
}
