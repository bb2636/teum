import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, BookOpen, FileText, Headphones } from 'lucide-react';
import { useHideTabBar } from '@/contexts/HideTabBarContext';
import { useEffect } from 'react';
import { SubscriptionStartModal } from '@/components/SubscriptionStartModal';

export function PaymentIntroPage() {
  const navigate = useNavigate();
  const { setHideTabBar } = useHideTabBar();
  const [showStartModal, setShowStartModal] = useState(false);

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
    navigate('/payment/checkout?plan=음악 생성 플랜(월간)&amount=4900');
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex justify-end p-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-[#4A2C1A]" />
          </button>
        </div>

        {/* Logo */}
        <div className="px-4 mb-6">
          <div className="flex items-center gap-2">
            <img
              src="/mureka_logo.png"
              alt="Mureka"
              className="h-4 w-auto"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="px-4 mb-8">
          <h1 className="text-2xl font-bold text-black mb-2">
            음악 생성, 무제한으로 즐겨보세요
          </h1>
          <p className="text-base text-gray-600">
            원하는 만큼 생성하고, 내 하루를 음악으로 저장할 수 있습니다.
          </p>
        </div>

        {/* Plan Benefits */}
        <div className="px-4 mb-8">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-gray-700">플랜혜택</span>
            <div className="flex items-center gap-2">
              <img
                src="/mureka_logo.png"
                alt="Mureka"
                className="h-3 w-auto"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 space-y-4">
            {/* Benefit 1 */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-5 h-5 text-gray-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-[#4A2C1A] mb-1">
                  일기 무제한 작성 · 저장
                </h3>
                <p className="text-sm text-gray-600">
                  횟수 제한 없이 기록을 남길 수 있습니다.
                </p>
              </div>
            </div>

            {/* Benefit 2 */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-gray-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-[#4A2C1A] mb-1">
                  Ai 분석 기반 가사 생성
                </h3>
                <p className="text-sm text-gray-600">
                  일기 내용을 분석하고, 이를 바탕으로 가사를 생성합니다.
                </p>
              </div>
            </div>

            {/* Benefit 3 */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                <Headphones className="w-5 h-5 text-gray-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-[#4A2C1A] mb-1">
                  음악 생성 (Mureka)
                </h3>
                <p className="text-sm text-gray-600">
                  월 5회, 1곡당 최대 2분까지 생성됩니다.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Subscription Card */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 rounded-t-3xl shadow-lg">
          <div className="max-w-md mx-auto px-4 py-6">
            <div className="mb-4">
              <div className="text-3xl font-bold text-black mb-1">4,900원</div>
              <div className="text-sm text-gray-600">월간 구독 · 매월 자동 결제입니다</div>
            </div>
            <button
              onClick={handleStartClick}
              className="w-full py-4 px-4 rounded-lg bg-[#665146] hover:bg-[#5A453A] text-white font-medium transition-colors"
            >
              월 4,900원으로 시작하기
            </button>
          </div>
        </div>
      </div>

      {/* Subscription Start Modal */}
      <SubscriptionStartModal
        isOpen={showStartModal}
        onClose={() => setShowStartModal(false)}
        onConfirm={handleConfirmStart}
        amount={4900}
      />
    </div>
  );
}
