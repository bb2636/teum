interface PaymentConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  amount: number;
}

export function PaymentConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  amount,
}: PaymentConfirmModalProps) {
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
            결제를 진행할까요?
          </h2>
          <p className="text-sm text-gray-600">
            월 {amount.toLocaleString()}원이 매월 자동 갱신됩니다.
          </p>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-lg text-[#4A2C1A] font-medium hover:bg-gray-100 transition-colors"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 px-4 rounded-full bg-[#665146] hover:bg-[#5A453A] text-white font-medium transition-colors"
          >
            결제하기
          </button>
        </div>
      </div>
    </div>
  );
}
