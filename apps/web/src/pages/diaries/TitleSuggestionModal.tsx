import { useEffect } from 'react';
import { useT } from '@/hooks/useTranslation';

interface TitleSuggestionModalProps {
  open: boolean;
  loading: boolean;
  titles: string[];
  onSelect: (title: string) => void;
  onClose: () => void;
  onRetry?: () => void;
}

export function TitleSuggestionModal({
  open,
  loading,
  titles,
  onSelect,
  onClose,
  onRetry,
}: TitleSuggestionModalProps) {
  const t = useT();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center animate-overlay-fade"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="title-suggestion-heading"
    >
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 animate-modal-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center space-y-2">
          <h2
            id="title-suggestion-heading"
            className="text-lg font-semibold text-[#4A2C1A]"
          >
            {t('diary.suggestTitleHeading')}
          </h2>
          <p className="text-sm text-gray-600">
            {t('diary.suggestTitleDesc')}
          </p>
        </div>

        <div className="mt-5 min-h-[140px] flex flex-col gap-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-6">
              <div className="w-7 h-7 border-[3px] border-amber-300 border-t-amber-600 rounded-full animate-spin" />
              <p className="text-sm text-gray-500">{t('diary.suggestTitleLoading')}</p>
            </div>
          ) : titles.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-6">
              <p className="text-sm text-gray-500 text-center">
                {t('diary.suggestTitleEmpty')}
              </p>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="text-sm text-[#4A2C1A] underline underline-offset-2"
                >
                  {t('diary.suggestTitleRetry')}
                </button>
              )}
            </div>
          ) : (
            titles.map((title, idx) => (
              <button
                key={`${idx}-${title}`}
                type="button"
                onClick={() => onSelect(title)}
                className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 hover:border-[#4A2C1A] hover:bg-[#FAF6F1] transition-colors text-[#4A2C1A] text-sm font-medium"
              >
                {title}
              </button>
            ))
          )}
        </div>

        <div className="flex gap-3 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-full text-[#4A2C1A] font-medium hover:bg-gray-100 transition-colors border border-gray-200"
          >
            {t('diary.suggestTitleWriteMyself')}
          </button>
        </div>
      </div>
    </div>
  );
}
