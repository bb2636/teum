interface ExitConfirmModalProps {
  onClose: () => void;
  onConfirm: () => void;
}

export function ExitConfirmModal({ onClose, onConfirm }: ExitConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center space-y-4">
          <h2 className="text-lg font-semibold text-[#4A2C1A]">
            작성 중인 일기를 종료할까요?
          </h2>
          <p className="text-sm text-gray-600">
            지금 나가면 입력한 내용이 저장되지 않습니다.
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
            className="flex-1 py-3 px-4 rounded-lg bg-[#4A2C1A] hover:bg-[#5A3C2A] text-white font-medium transition-colors"
          >
            나가기
          </button>
        </div>
      </div>
    </div>
  );
}
