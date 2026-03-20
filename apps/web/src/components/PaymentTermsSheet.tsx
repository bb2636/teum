import { useState } from 'react';
import { X, ChevronRight } from 'lucide-react';
import { TermsModal } from '@/pages/my/TermsModal';

interface PaymentTermsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAgree: (agreed: boolean) => void;
}

export function PaymentTermsSheet({ isOpen, onClose, onAgree }: PaymentTermsSheetProps) {
  const [agreeAll, setAgreeAll] = useState(false);
  const [agreeService, setAgreeService] = useState(false);
  const [agreePayment, setAgreePayment] = useState(false);
  const [agreeRefund, setAgreeRefund] = useState(false);
  const [showServiceTerms, setShowServiceTerms] = useState(false);
  const [showPaymentTerms, setShowPaymentTerms] = useState(false);
  const [showRefundTerms, setShowRefundTerms] = useState(false);

  const handleAgreeAll = (checked: boolean) => {
    setAgreeAll(checked);
    setAgreeService(checked);
    setAgreePayment(checked);
    setAgreeRefund(checked);
  };

  const handleIndividualAgree = () => {
    const allAgreed = agreeService && agreePayment && agreeRefund;
    setAgreeAll(allAgreed);
  };

  const handleServiceChange = (checked: boolean) => {
    setAgreeService(checked);
    if (!checked) setAgreeAll(false);
    else handleIndividualAgree();
  };

  const handlePaymentChange = (checked: boolean) => {
    setAgreePayment(checked);
    if (!checked) setAgreeAll(false);
    else handleIndividualAgree();
  };

  const handleRefundChange = (checked: boolean) => {
    setAgreeRefund(checked);
    if (!checked) setAgreeAll(false);
    else handleIndividualAgree();
  };

  const allRequiredAgreed = agreeService && agreePayment && agreeRefund;

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 flex items-end animate-overlay-fade"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-t-3xl w-full max-w-md mx-auto max-h-[80vh] overflow-y-auto animate-modal-sheet"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
            <h2 className="text-lg font-semibold text-[#4A2C1A]">이용약관에 동의해주세요</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* 전체 동의 */}
            <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={agreeAll}
                onChange={(e) => handleAgreeAll(e.target.checked)}
                className="w-5 h-5 text-[#4A2C1A] focus:ring-[#4A2C1A] rounded"
              />
              <span className="font-medium text-[#4A2C1A]">전체 동의</span>
            </label>

            <div className="space-y-3 pt-2">
              {/* 서비스 이용약관 */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-3 flex-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreeService}
                    onChange={(e) => handleServiceChange(e.target.checked)}
                    className="w-5 h-5 text-[#665146] focus:ring-[#665146] rounded"
                  />
                  <span className="text-sm text-gray-700">[필수] 서비스 이용약관에 동의합니다.</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowServiceTerms(true)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* 정기결제/자동갱신 */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-3 flex-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreePayment}
                    onChange={(e) => handlePaymentChange(e.target.checked)}
                    className="w-5 h-5 text-[#665146] focus:ring-[#665146] rounded"
                  />
                  <span className="text-sm text-gray-700">[필수] 정기 결제 및 자동 갱신에 동의합니다.</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowPaymentTerms(true)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* 환불/취소 정책 */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-3 flex-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreeRefund}
                    onChange={(e) => handleRefundChange(e.target.checked)}
                    className="w-5 h-5 text-[#665146] focus:ring-[#665146] rounded"
                  />
                  <span className="text-sm text-gray-700">[필수] 환불/해지 정책을 확인했습니다.</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowRefundTerms(true)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                if (allRequiredAgreed) {
                  onAgree(true);
                  // onClose는 PaymentPage에서 처리
                }
              }}
              disabled={!allRequiredAgreed}
              className="w-full py-4 px-4 rounded-lg bg-[#665146] hover:bg-[#5A453A] text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              월 4,900원으로 시작하기
            </button>
          </div>
        </div>
      </div>

      {showServiceTerms && (
        <TermsModal type="service" onClose={() => setShowServiceTerms(false)} />
      )}
      {showPaymentTerms && (
        <TermsModal type="payment" onClose={() => setShowPaymentTerms(false)} />
      )}
      {showRefundTerms && (
        <TermsModal type="refund" onClose={() => setShowRefundTerms(false)} />
      )}
    </>
  );
}
