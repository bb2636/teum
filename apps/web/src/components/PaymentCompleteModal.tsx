import { useEffect } from 'react';
import { useHideTabBar } from '@/contexts/HideTabBarContext';

interface PaymentCompleteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PaymentCompleteModal({
  isOpen,
  onClose,
}: PaymentCompleteModalProps) {
  const { setHideTabBar } = useHideTabBar();

  useEffect(() => {
    if (isOpen) {
      setHideTabBar(true);
    } else {
      setHideTabBar(false);
    }
    // Cleanup: 모달이 닫힐 때 하단바 다시 표시
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
          <h2 className="text-lg font-semibold text-[#4A2C1A]">결제 완료</h2>
          <p className="text-sm text-gray-700">결제가 완료되었습니다!</p>
        </div>

        <div className="flex justify-center mt-6">
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-lg bg-[#4A2C1A] hover:bg-[#3A2010] text-white font-medium transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
