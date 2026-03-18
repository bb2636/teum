import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscriptions, usePayments, useCancelSubscription } from '@/hooks/usePayment';
import { useMe } from '@/hooks/useProfile';
import { SubscriptionCancelModal } from '@/components/SubscriptionCancelModal';
import { Toast } from '@/components/Toast';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export function PaymentHistoryPage() {
  const navigate = useNavigate();
  const { data: subscriptions = [], isLoading: subscriptionsLoading } = useSubscriptions();
  const { data: payments = [], isLoading: paymentsLoading } = usePayments();
  const { data: user } = useMe();
  const cancelSubscription = useCancelSubscription();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showToast, setShowToast] = useState(false);

  if (subscriptionsLoading || paymentsLoading) {
    return (
      <div className="min-h-screen bg-beige-50 flex items-center justify-center">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  const activeSubscription = subscriptions.find((s) => s.status === 'active');

  return (
    <div className="min-h-screen bg-beige-50 pb-20">
      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold text-brown-900">결제 내역</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* 결제 정보 */}
        {activeSubscription && (
          <div>
            <h2 className="text-lg font-semibold text-brown-900 mb-3">결제 정보</h2>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="mb-3">
                <p className="text-lg font-semibold text-brown-900">
                  월 {parseInt(activeSubscription.amount.toString()).toLocaleString()}원
                </p>
              </div>
              {activeSubscription.endDate && (
                <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
                  <span>다음 결제 예정일</span>
                  <span>{format(new Date(activeSubscription.endDate), 'yyyy.MM.dd', { locale: ko })}</span>
                </div>
              )}
              <div className="text-right">
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
          </div>
        )}


        {/* 결제 내역 */}
        <div>
          <h2 className="text-lg font-semibold text-brown-900 mb-3">결제 내역</h2>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">결제 내역이 없습니다</p>
          ) : (
            <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-200">
              {payments.map((payment) => {
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
                  <div key={payment.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-brown-900 mb-1">
                          {format(new Date(payment.createdAt), 'yyyy.MM.dd', { locale: ko })}
                        </p>
                        {associatedSubscription && (
                          <>
                            <p className="text-sm text-muted-foreground">
                              {periodStart}~{periodEnd} 기간 동안의 멤버십
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {user?.email || '이메일 없음'}
                            </p>
                          </>
                        )}
                        {!associatedSubscription && (
                          <p className="text-sm text-muted-foreground">
                            {payment.paymentMethod || '결제 수단 미확인'}
                          </p>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-brown-900 ml-4">
                        {parseInt(payment.amount.toString()).toLocaleString()}원
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
              setShowToast(true);
            } catch (error) {
              console.error('Failed to cancel subscription:', error);
              alert('구독 취소에 실패했습니다.');
            }
          }}
          isLoading={cancelSubscription.isPending}
        />
      )}

      {/* 토스트 메시지 */}
      <Toast
        message="구독이 취소되었습니다."
        isVisible={showToast}
        onClose={() => setShowToast(false)}
      />
    </div>
  );
}
