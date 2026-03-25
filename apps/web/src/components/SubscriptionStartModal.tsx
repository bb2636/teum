interface SubscriptionStartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  amount: number;
}

export function SubscriptionStartModal({
  isOpen,
  onClose,
  onConfirm,
}: SubscriptionStartModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-overlay-fade"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl animate-modal-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <p className="text-sm text-gray-500">월 4,900원</p>
          <h2 className="text-lg font-bold text-[#4A2C1A] mt-1">
            구독을 시작하시겠습니까?
          </h2>
          <p className="text-sm text-gray-500 mt-3">
            빠르게 쓰거나, 질문에 따라<br />차근히 정리할 수 있습니다.
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
            구독하기
          </button>
        </div>
      </div>
    </div>
  );
}
