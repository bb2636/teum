import { useNavigate } from 'react-router-dom';
import { X, Sparkles } from 'lucide-react';
import { useHideTabBar } from '@/contexts/HideTabBarContext';
import { useEffect } from 'react';

export function PaymentSuccessPage() {
  const navigate = useNavigate();
  const { setHideTabBar } = useHideTabBar();

  useEffect(() => {
    setHideTabBar(true);
    return () => {
      setHideTabBar(false);
    };
  }, [setHideTabBar]);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="flex justify-end p-4">
        <button
          onClick={() => navigate('/home')}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5 text-[#4A2C1A]" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center px-4">
        <div className="text-left space-y-2">
          <h1 className="text-2xl font-bold text-black leading-tight">
            구독이<br />
            시작되었습니다.
          </h1>
          <p className="text-2xl font-bold text-black leading-tight mt-4">
            일기를 분석해<br />
            가사를 만들고,<br />
            음악까지 생성해 보세요.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 space-y-4">
        <button
          onClick={() => navigate('/home')}
          className="w-full text-center text-sm text-gray-600 hover:text-gray-800"
        >
          홈으로
        </button>
        <button
          onClick={() => navigate('/music')}
          className="w-full py-4 px-4 rounded-lg bg-[#665146] hover:bg-[#5A453A] text-white font-medium transition-colors flex items-center justify-center gap-2"
        >
          음악 생성하기
          <Sparkles className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
