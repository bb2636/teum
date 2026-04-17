import { ReactNode, useEffect, useId, useRef } from 'react';
import { Button } from '@/components/ui/button';

interface AdminConfirmModalProps {
  isOpen: boolean;
  title: string;
  description?: ReactNode;
  confirmText: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
  loadingText?: string;
  variant?: 'confirm' | 'alert';
  closeOnOverlayClick?: boolean;
}

export function AdminConfirmModal({
  isOpen,
  title,
  description,
  confirmText,
  cancelText = '취소',
  onConfirm,
  onClose,
  isLoading = false,
  loadingText,
  variant = 'confirm',
  closeOnOverlayClick,
}: AdminConfirmModalProps) {
  const titleId = useId();
  const descId = useId();
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

  const allowOverlayClose =
    closeOnOverlayClick ?? (variant === 'confirm');

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const focusTimer = setTimeout(() => confirmBtnRef.current?.focus(), 0);

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);

    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKey);
      previousFocusRef.current?.focus?.();
    };
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-50 animate-overlay-fade"
        onClick={allowOverlayClose && !isLoading ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 flex items-center justify-center z-[60] pointer-events-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
      >
        <div
          className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 pointer-events-auto animate-modal-pop"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 pt-8 pb-6">
            <h2
              id={titleId}
              className="text-lg font-semibold text-[#4A2C1A] text-center mb-3"
            >
              {title}
            </h2>
            {description && (
              <div
                id={descId}
                className="text-sm text-gray-600 text-center"
              >
                {description}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 px-6 pb-6">
            {variant === 'confirm' && (
              <Button
                onClick={onClose}
                variant="outline"
                disabled={isLoading}
                className="border-0 text-gray-700 hover:bg-gray-50 rounded-full"
              >
                {cancelText}
              </Button>
            )}
            <Button
              ref={confirmBtnRef}
              onClick={onConfirm}
              disabled={isLoading}
              className="bg-[#4A2C1A] text-white hover:bg-[#3A2010] rounded-full disabled:opacity-50"
            >
              {isLoading && loadingText ? loadingText : confirmText}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
