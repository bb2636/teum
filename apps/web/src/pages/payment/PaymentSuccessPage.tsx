import { useNavigate } from 'react-router-dom';
import { X, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    <div className="min-h-screen bg-beige-50 flex flex-col">
      {/* Header */}
      <div className="flex justify-end p-4">
        <button
          onClick={() => navigate('/home')}
          className="p-2 rounded-full hover:bg-gray-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-[#4A2C1A]">
            구독이 시작되었습니다.
          </h1>
          <p className="text-sm text-gray-600">
            일기를 분석해 가사를 만들고, 음악까지 생성해 보세요.
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
        <Button
          onClick={() => navigate('/music')}
          className="w-full bg-[#4A2C1A] hover:bg-[#5A3C2A] text-white py-3 font-medium"
        >
          <Star className="w-4 h-4 mr-2" />
          음악 생성하기
        </Button>
      </div>
    </div>
  );
}
