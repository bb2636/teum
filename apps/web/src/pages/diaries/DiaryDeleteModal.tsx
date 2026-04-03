import { useEffect } from 'react';
import { useHideTabBar } from '@/contexts/HideTabBarContext';
import { useT } from '@/hooks/useTranslation';

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
  const t = useT();

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
          <h2 className="text-lg font-semibold text-[#4A2C1A]">{t('common.delete')}</h2>
          <p className="text-sm text-gray-700">{t('diary.deleteQuestion')}</p>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-3 px-4 rounded-lg text-[#4A2C1A] font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 py-3 px-4 rounded-full bg-[#4A2C1A] hover:bg-[#3A2010] text-white font-medium transition-colors disabled:opacity-50"
          >
            {isLoading ? t('common.deleting') : t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
