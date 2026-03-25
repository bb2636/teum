import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscriptions, usePayments, useCancelSubscription, getEffectiveSubscription } from '@/hooks/usePayment';
import { useMe } from '@/hooks/useProfile';
import { SubscriptionCancelModal } from '@/components/SubscriptionCancelModal';
import { format } from 'date-fns';
import { getDateLocale } from '@/lib/dateFnsLocale';
import { useT } from '@/hooks/useTranslation';

export function PaymentHistoryPage() {
  const navigate = useNavigate();
  const t = useT();
  const locale = getDateLocale();
  const { data: subscriptions = [], isLoading: subscriptionsLoading } = useSubscriptions();
  const { data: payments = [], isLoading: paymentsLoading } = usePayments();
  useMe();
  const cancelSubscription = useCancelSubscription();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showCancelSuccess, setShowCancelSuccess] = useState(false);
  const [showCancelError, setShowCancelError] = useState(false);
  const [cancelErrorMessage, setCancelErrorMessage] = useState('');

  if (subscriptionsLoading || paymentsLoading) {
    return (
      <div className="min-h-screen bg-beige-50 flex items-center justify-center">
        <div className="text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  const effectiveSubscription = getEffectiveSubscription(subscriptions);
  const isSubscriptionActive = effectiveSubscription?.status === 'active';

  const NICEPAY_CARD_NAMES: Record<string, string> = {
    '01': 'BC카드', '02': 'KB국민카드', '03': '하나카드', '04': '삼성카드',
    '06': '신한카드', '07': '현대카드', '08': '롯데카드', '11': '씨티카드',
    '12': 'NH농협카드', '15': '우리카드',
  };

  const formatPaymentMethod = (method?: string): string => {
    if (!method) return t('payment.paymentMethodUnknown');
    if (method.startsWith('CARD_')) {
      const code = method.replace('CARD_', '');
      return (NICEPAY_CARD_NAMES[code] || 'Card') + ' ' + t('payment.cardPayment');
    }
    if (method === 'CARD') return t('payment.cardPayment');
    if (method === 'BANK') return t('payment.bankTransfer');
    if (method === 'CELLPHONE') return t('payment.mobilePayment');
    if (method.startsWith('card_')) return method.replace('card_', '') + ' ' + t('payment.cardPayment');
    if (method === 'card') return t('payment.cardPayment');
    if (method === 'bank_transfer') return t('payment.bankTransfer');
    return method;
  };

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="max-w-md mx-auto">
        <div className="sticky top-0 z-30 bg-white px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-[#4A2C1A]">{t('payment.history')}</h1>
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="px-4 py-6 space-y-6">

          {effectiveSubscription && (
            <div>
              <h2 className="text-sm font-medium text-gray-500 mb-2">{t('payment.paymentInfoLabel')}</h2>
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-lg font-semibold text-[#4A2C1A]">
                    {t('payment.monthlyAmount', { amount: parseInt(effectiveSubscription.amount.toString()).toLocaleString() })}
                  </p>
                  {!isSubscriptionActive && (
                    <span className="text-xs text-red-500 font-medium bg-red-50 px-2 py-1 rounded-full">
                      {t('my.subscriptionCancelled')}
                    </span>
                  )}
                </div>
                {effectiveSubscription.endDate && (
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>{isSubscriptionActive ? t('payment.nextPaymentSchedule') : t('my.availableUntil')}</span>
                    <span>{format(new Date(effectiveSubscription.endDate), 'yyyy.MM.dd', { locale })}</span>
                  </div>
                )}
              </div>
              {isSubscriptionActive && (
                <div className="text-right mt-2">
                  <button
                    type="button"
                    onClick={() => setShowCancelModal(true)}
                    disabled={cancelSubscription.isPending}
                    className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    {t('payment.cancelSubscription')}
                  </button>
                </div>
              )}
            </div>
          )}


          <div>
            <h2 className="text-sm font-medium text-gray-500 mb-3">{t('payment.history')}</h2>
            {payments.length === 0 ? (
              <p className="text-sm text-gray-500">{t('payment.noHistory')}</p>
            ) : (
              <div className="space-y-0">
                {payments.map((payment, index) => {
                  const associatedSubscription = payment.subscriptionId
                    ? subscriptions.find((s) => s.id === payment.subscriptionId)
                    : null;
                  
                  const periodStart = associatedSubscription
                    ? format(new Date(associatedSubscription.startDate), 'yyyy.MM.dd', { locale })
                    : format(new Date(payment.createdAt), 'yyyy.MM.dd', { locale });
                  const periodEnd = associatedSubscription?.endDate
                    ? format(new Date(associatedSubscription.endDate), 'yyyy.MM.dd', { locale })
                    : (() => {
                        const start = associatedSubscription
                          ? new Date(associatedSubscription.startDate)
                          : new Date(payment.createdAt);
                        start.setMonth(start.getMonth() + 1);
                        return format(start, 'yyyy.MM.dd', { locale });
                      })();

                  return (
                    <div key={payment.id}>
                      <div className="py-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-sm text-[#4A2C1A]">
                                {format(new Date(payment.createdAt), 'yyyy.MM.dd', { locale })}
                              </p>
                              <p className="text-sm font-semibold text-[#4A2C1A]">
                                {parseInt(payment.amount.toString()).toLocaleString()}{t('payment.won')}
                              </p>
                            </div>
                            {associatedSubscription && (
                              <p className="text-sm text-gray-500">
                                {t('payment.membershipPeriod', { start: periodStart, end: periodEnd })}
                              </p>
                            )}
                            <p className="text-sm text-gray-500">
                              {formatPaymentMethod(payment.paymentMethod)}
                            </p>
                          </div>
                        </div>
                      </div>
                      {index < payments.length - 1 && (
                        <div className="border-b border-gray-200" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {showCancelModal && effectiveSubscription && isSubscriptionActive && (
        <SubscriptionCancelModal
          isOpen={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          onConfirm={async () => {
            try {
              await cancelSubscription.mutateAsync(effectiveSubscription.id);
              setShowCancelModal(false);
              setShowCancelSuccess(true);
            } catch (error: any) {
              console.error('Failed to cancel subscription:', error);
              setShowCancelModal(false);
              const msg = error?.message || '';
              if (msg.includes('active') || msg.includes('cancelled')) {
                setCancelErrorMessage(t('payment.alreadyCancelled'));
              } else {
                setCancelErrorMessage(t('payment.cancelFailed'));
              }
              setShowCancelError(true);
            }
          }}
          isLoading={cancelSubscription.isPending}
        />
      )}

      {showCancelSuccess && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-overlay-fade">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl text-center animate-modal-pop">
            <p className="text-[#4A2C1A] mb-6">{t('payment.subscriptionCancelled')}</p>
            <button
              onClick={() => setShowCancelSuccess(false)}
              className="w-full py-3 px-4 rounded-full bg-[#665146] hover:bg-[#5A453A] text-white font-medium transition-colors"
            >
              {t('common.confirm')}
            </button>
          </div>
        </div>
      )}

      {showCancelError && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-overlay-fade">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl text-center animate-modal-pop">
            <p className="text-[#4A2C1A] mb-6">{cancelErrorMessage}</p>
            <button
              onClick={() => setShowCancelError(false)}
              className="w-full py-3 px-4 rounded-full bg-[#665146] hover:bg-[#5A453A] text-white font-medium transition-colors"
            >
              {t('common.confirm')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
