import { useEffect } from 'react';
import { useHideTabBar } from '@/contexts/HideTabBarContext';

interface DiaryDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function DiaryDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: DiaryDeleteModalProps) {
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
          <h2 className="text-lg font-semibold text-[#4A2C1A]">삭제</h2>
          <p className="text-sm text-gray-700">일기를 삭제하시겠습니까?</p>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-3 px-4 rounded-lg text-[#4A2C1A] font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 py-3 px-4 rounded-full bg-[#665146] hover:bg-[#5A453A] text-white font-medium transition-colors disabled:opacity-50"
          >
            {isLoading ? '삭제 중...' : '확인'}
          </button>
        </div>
      </div>
    </div>
  );
}
