import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuestionDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  question: string;
  isLoading?: boolean;
}

export function QuestionDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  question,
  isLoading = false,
}: QuestionDeleteModalProps) {
  const handleClose = () => {
    onClose();
  };

  const handleConfirm = async () => {
    await onConfirm();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div
          className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-[#4A2C1A]">삭제하기</h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <p className="text-base font-medium text-[#4A2C1A] mb-3">
              질문을 삭제하시겠습니까?
            </p>
            <p className="text-sm text-gray-600">{question}</p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
            <Button
              onClick={handleClose}
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
              disabled={isLoading}
            >
              취소
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isLoading}
              className="bg-[#4A2C1A] text-white hover:bg-[#3A2215] disabled:opacity-50"
            >
              {isLoading ? '삭제 중...' : '삭제'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
