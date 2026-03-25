import { useT } from '@/hooks/useTranslation';

interface ExitConfirmModalProps {
  onClose: () => void;
  onConfirm: () => void;
}

export function ExitConfirmModal({ onClose, onConfirm }: ExitConfirmModalProps) {
  const t = useT();

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center animate-overlay-fade" onClick={onClose}>
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 animate-modal-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center space-y-4">
          <h2 className="text-lg font-semibold text-[#4A2C1A]">
            {t('diary.exitQuestion')}
          </h2>
          <p className="text-sm text-gray-600">
            {t('diary.exitWarning')}
          </p>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-lg text-[#4A2C1A] font-medium hover:bg-gray-100 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 px-4 rounded-full bg-[#665146] hover:bg-[#5A453A] text-white font-medium transition-colors"
          >
            {t('diary.exit')}
          </button>
        </div>
      </div>
    </div>
  );
}
