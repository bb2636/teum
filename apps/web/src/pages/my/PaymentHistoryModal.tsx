import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Payment, Subscription } from '@/hooks/usePayment';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

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
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-overlay-fade">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-modal-pop">
        <div className="sticky top-0 bg-white border-b border-brown-200 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-brown-900">결제 내역</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-4 space-y-6">
          {/* Subscriptions */}
          <div>
            <h3 className="font-semibold text-brown-900 mb-3">구독 내역</h3>
            {subscriptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">구독 내역이 없습니다</p>
            ) : (
              <div className="space-y-3">
                {subscriptions.map((sub) => {
                  // 다음 결제일 계산 (endDate가 있으면 endDate, 없으면 startDate + 1개월)
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
                            구독일: {format(new Date(sub.startDate), 'yyyy.MM.dd', { locale: ko })}
                          </p>
                          {sub.status === 'active' && (
                            <p className="text-xs text-muted-foreground mt-1">
                              다음 결제일: {format(nextPaymentDate, 'yyyy.MM.dd', { locale: ko })}
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
                            ? '활성'
                            : sub.status === 'cancelled'
                            ? '취소됨'
                            : '만료'}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-brown-900">
                        {parseInt(sub.amount.toString()).toLocaleString()}원
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Payments */}
          <div>
            <h3 className="font-semibold text-brown-900 mb-3">결제 내역</h3>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">결제 내역이 없습니다</p>
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
                          {format(new Date(payment.createdAt), 'yyyy.MM.dd HH:mm', {
                            locale: ko,
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {payment.paymentMethod || '결제 수단 미확인'}
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
                          ? '완료'
                          : payment.status === 'failed'
                          ? '실패'
                          : payment.status === 'refunded'
                          ? '환불'
                          : '대기'}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-brown-900">
                      {parseInt(payment.amount.toString()).toLocaleString()}원
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
