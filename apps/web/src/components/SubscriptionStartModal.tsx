import { useT } from '@/hooks/useTranslation';

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
  amount,
}: SubscriptionStartModalProps) {
  const t = useT();
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
          <p className="text-sm text-gray-500">{t('payment.monthlyPrice', { amount: amount.toLocaleString() })}</p>
          <h2 className="text-lg font-bold text-[#4A2C1A] mt-1">
            {t('payment.startSubscriptionQuestion')}
          </h2>
          <p className="text-sm text-gray-500 mt-3 whitespace-pre-line">
            {t('payment.subscriptionDesc')}
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
            {t('payment.subscribe')}
          </button>
        </div>
      </div>
    </div>
  );
}
