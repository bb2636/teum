import { useEffect } from 'react';
import { useHideTabBar } from '@/contexts/HideTabBarContext';

interface SubscriptionCancelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function SubscriptionCancelModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: SubscriptionCancelModalProps) {
  const { setHideTabBar } = useHideTabBar();

  useEffect(() => {
    if (isOpen) {
      setHideTabBar(true);
    } else {
      setHideTabBar(false);
    }
    return () => {
      setHideTabBar(false);
    };
  }, [isOpen, setHideTabBar]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center animate-overlay-fade"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl animate-modal-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center space-y-4">
          <h2 className="text-lg font-semibold text-[#4A2C1A]">
            구독을 취소하시겠습니까?
          </h2>
          <p className="text-sm text-gray-600">
            취소 후에도 결제 기간이 끝날 때까지<br />플랜 혜택을 이용할 수 있습니다.
          </p>
        </div>

        <div className="flex gap-3 mt-6 justify-center">
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-6 py-3 rounded-full text-[#4A2C1A] font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {isLoading ? '취소 중...' : '구독취소'}
          </button>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-6 py-3 rounded-full bg-[#4A2C1A] hover:bg-[#3A2010] text-white font-medium transition-colors disabled:opacity-50"
          >
            유지하기
          </button>
        </div>
      </div>
    </div>
  );
}
