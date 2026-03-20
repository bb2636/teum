import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscriptions, usePayments, useCancelSubscription } from '@/hooks/usePayment';
import { useMe } from '@/hooks/useProfile';
import { SubscriptionCancelModal } from '@/components/SubscriptionCancelModal';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export function PaymentHistoryPage() {
  const navigate = useNavigate();
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
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  const activeSubscription = subscriptions.find((s) => s.status === 'active');

  const formatPaymentMethod = (method?: string): string => {
    if (!method) return '결제 수단 미확인';
    if (method.startsWith('card_')) return method.replace('card_', '') + ' 카드결제';
    if (method.startsWith('easy_pay_')) {
      const provider = method.replace('easy_pay_', '');
      const names: Record<string, string> = { npay: '네이버페이', toss: '토스페이', apple: 'Apple Pay', kakao: '카카오페이' };
      return names[provider] || provider;
    }
    if (method === 'card') return '카드결제';
    if (method === 'easy_pay') return '간편결제';
    if (method === 'bank_transfer') return '계좌이체';
    return method;
  };

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="max-w-md mx-auto">
        {/* Header - 고정 */}
        <div className="sticky top-0 z-30 bg-white px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-[#4A2C1A]">결제 내역</h1>
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="px-4 py-6 space-y-6">

          {/* 결제 정보 */}
          {activeSubscription && (
            <div>
              <h2 className="text-sm font-medium text-gray-500 mb-2">결제 정보</h2>
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <p className="text-lg font-semibold text-[#4A2C1A] mb-3">
                  월 {parseInt(activeSubscription.amount.toString()).toLocaleString()}원
                </p>
                {activeSubscription.endDate && (
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>다음 결제 예정일</span>
                    <span>{format(new Date(activeSubscription.endDate), 'yyyy.MM.dd', { locale: ko })}</span>
                  </div>
                )}
              </div>
              {/* 구독 취소 버튼 - 결제 정보 바로 아래 */}
              <div className="text-right mt-2">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(true)}
                  disabled={cancelSubscription.isPending}
                  className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  구독취소
                </button>
              </div>
            </div>
          )}


          {/* 결제 내역 */}
          <div>
            <h2 className="text-sm font-medium text-gray-500 mb-3">결제 내역</h2>
            {payments.length === 0 ? (
              <p className="text-sm text-gray-500">결제 내역이 없습니다</p>
            ) : (
              <div className="space-y-0">
                {payments.map((payment, index) => {
                  // Find associated subscription for this payment
                  const associatedSubscription = payment.subscriptionId
                    ? subscriptions.find((s) => s.id === payment.subscriptionId)
                    : null;
                  
                  // Calculate period (startDate to endDate or startDate + 1 month)
                  const periodStart = associatedSubscription
                    ? format(new Date(associatedSubscription.startDate), 'yyyy.MM.dd', { locale: ko })
                    : format(new Date(payment.createdAt), 'yyyy.MM.dd', { locale: ko });
                  const periodEnd = associatedSubscription?.endDate
                    ? format(new Date(associatedSubscription.endDate), 'yyyy.MM.dd', { locale: ko })
                    : (() => {
                        const start = associatedSubscription
                          ? new Date(associatedSubscription.startDate)
                          : new Date(payment.createdAt);
                        start.setMonth(start.getMonth() + 1);
                        return format(start, 'yyyy.MM.dd', { locale: ko });
                      })();

                  return (
                    <div key={payment.id}>
                      <div className="py-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-sm text-[#4A2C1A]">
                                {format(new Date(payment.createdAt), 'yyyy.MM.dd', { locale: ko })}
                              </p>
                              <p className="text-sm font-semibold text-[#4A2C1A]">
                                {parseInt(payment.amount.toString()).toLocaleString()}원
                              </p>
                            </div>
                            {associatedSubscription && (
                              <p className="text-sm text-gray-500">
                                {periodStart}~{periodEnd} 기간 동안의 멤버십
                              </p>
                            )}
                            <p className="text-sm text-gray-500">
                              {formatPaymentMethod(payment.paymentMethod)}
                            </p>
                          </div>
                        </div>
                      </div>
                      {/* 구분선 */}
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

      {/* 구독 취소 모달 */}
      {showCancelModal && activeSubscription && (
        <SubscriptionCancelModal
          isOpen={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          onConfirm={async () => {
            try {
              await cancelSubscription.mutateAsync(activeSubscription.id);
              setShowCancelModal(false);
              setShowCancelSuccess(true);
            } catch (error: any) {
              console.error('Failed to cancel subscription:', error);
              setShowCancelModal(false);
              const msg = error?.message || '';
              if (msg.includes('active') || msg.includes('cancelled')) {
                setCancelErrorMessage('이미 취소된 구독입니다.');
              } else {
                setCancelErrorMessage('구독 취소에 실패했습니다.');
              }
              setShowCancelError(true);
            }
          }}
          isLoading={cancelSubscription.isPending}
        />
      )}

      {/* 구독 취소 성공 모달 */}
      {showCancelSuccess && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-overlay-fade">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl text-center animate-modal-pop">
            <p className="text-[#4A2C1A] mb-6">구독이 취소되었습니다.</p>
            <button
              onClick={() => setShowCancelSuccess(false)}
              className="w-full py-3 px-4 rounded-full bg-[#665146] hover:bg-[#5A453A] text-white font-medium transition-colors"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 구독 취소 실패 모달 */}
      {showCancelError && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-overlay-fade">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl text-center animate-modal-pop">
            <p className="text-[#4A2C1A] mb-6">{cancelErrorMessage}</p>
            <button
              onClick={() => setShowCancelError(false)}
              className="w-full py-3 px-4 rounded-full bg-[#665146] hover:bg-[#5A453A] text-white font-medium transition-colors"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
