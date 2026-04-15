import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Payment, Subscription } from '@/hooks/usePayment';
import { format } from 'date-fns';
import { getDateLocale } from '@/lib/dateFnsLocale';
import { useT } from '@/hooks/useTranslation';

function formatAmount(amount: number, currency: string): string {
  const num = Math.round(amount);
  if (currency === 'USD') return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${num.toLocaleString()}원`;
}

interface PaymentHistoryModalProps {
  subscriptions: Subscription[];
  payments: Payment[];
  onClose: () => void;
}

export function PaymentHistoryModal({
  subscriptions,
  payments,
  onClose,
}: PaymentHistoryModalProps) {
  const t = useT();
  const locale = getDateLocale();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-overlay-fade">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-modal-pop">
        <div className="sticky top-0 bg-white border-b border-brown-200 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-brown-900">{t('payment.history')}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-4 space-y-6">
          <div>
            <h3 className="font-semibold text-brown-900 mb-3">{t('payment.subscriptionHistory')}</h3>
            {subscriptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('payment.noSubscriptionHistory')}</p>
            ) : (
              <div className="space-y-3">
                {subscriptions.map((sub) => {
                  const nextPaymentDate = sub.endDate 
                    ? new Date(sub.endDate)
                    : (() => {
                        const start = new Date(sub.startDate);
                        start.setMonth(start.getMonth() + 1);
                        return start;
                      })();
                  
                  return (
                    <div
                      key={sub.id}
                      className="bg-brown-50 rounded-lg p-3 border border-brown-200"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-brown-900">{sub.planName}</p>
                          <p className="text-xs text-muted-foreground">
                            {t('payment.subscriptionDate', { date: format(new Date(sub.startDate), 'yyyy.MM.dd', { locale }) })}
                          </p>
                          {sub.status === 'active' && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {t('payment.nextPaymentDate', { date: format(nextPaymentDate, 'yyyy.MM.dd', { locale }) })}
                            </p>
                          )}
                        </div>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            sub.status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : sub.status === 'cancelled'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {sub.status === 'active'
                            ? t('payment.statusActive')
                            : sub.status === 'cancelled'
                            ? t('payment.statusCancelled')
                            : t('payment.statusExpired')}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-brown-900">
                        {formatAmount(sub.amount, sub.currency)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h3 className="font-semibold text-brown-900 mb-3">{t('payment.history')}</h3>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('payment.noPaymentHistory')}</p>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="bg-brown-50 rounded-lg p-3 border border-brown-200"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(payment.createdAt), 'yyyy.MM.dd HH:mm', { locale })}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {payment.paymentMethod || t('payment.paymentMethodUnconfirmed')}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          payment.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : payment.status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : payment.status === 'refunded'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {payment.status === 'completed'
                          ? t('payment.statusCompleted')
                          : payment.status === 'failed'
                          ? t('payment.statusFailed')
                          : payment.status === 'refunded'
                          ? t('payment.statusRefunded')
                          : t('payment.statusPending')}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-brown-900">
                      {formatAmount(payment.amount, payment.currency)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
