import { AdminConfirmModal } from './AdminConfirmModal';

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
  const handleConfirm = async () => {
    await onConfirm();
    onClose();
  };

  return (
    <AdminConfirmModal
      isOpen={isOpen}
      title="질문을 삭제하시겠습니까?"
      description={question}
      confirmText="삭제"
      loadingText="삭제 중..."
      onConfirm={handleConfirm}
      onClose={onClose}
      isLoading={isLoading}
    />
  );
}
