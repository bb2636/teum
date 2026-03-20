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
      {/* Overlay - 밝은 베이지/미색 배경 */}
      <div
        className="fixed inset-0 bg-black/40 z-40 animate-overlay-fade"
        onClick={handleClose}
      />

      {/* Modal - 이미지와 동일한 스타일 */}
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 pointer-events-auto animate-modal-pop"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Content - 중앙 정렬 */}
          <div className="px-6 pt-8 pb-6">
            <h2 className="text-lg font-semibold text-[#4A2C1A] text-center mb-4">
              질문을 삭제하시겠습니까?
            </h2>
            <p className="text-sm text-gray-600 text-center">{question}</p>
          </div>

          {/* Footer - 버튼 오른쪽 정렬 */}
          <div className="flex justify-end gap-3 px-6 pb-6">
            <Button
              onClick={handleClose}
              variant="outline"
              className="border-0 text-gray-700 hover:bg-gray-50 rounded-full"
              disabled={isLoading}
            >
              취소
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isLoading}
              className="bg-[#665146] text-white hover:bg-[#5A453A] rounded-full disabled:opacity-50"
            >
              {isLoading ? '삭제 중...' : '삭제'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
