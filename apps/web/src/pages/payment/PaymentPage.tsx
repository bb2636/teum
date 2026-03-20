import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, BookOpen, FileText, Headphones } from 'lucide-react';
import { useProcessPayment } from '@/hooks/usePayment';
import { PaymentTermsSheet } from '@/components/PaymentTermsSheet';
import { PaymentConfirmModal } from '@/components/PaymentConfirmModal';
import { useHideTabBar } from '@/contexts/HideTabBarContext';

type PaymentMethod = 'card' | 'easy_pay' | 'bank_transfer';
type EasyPayProvider = 'toss' | 'npay' | 'apple';

export function PaymentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setHideTabBar } = useHideTabBar();
  const amount = searchParams.get('amount') || '0';
  const planName = searchParams.get('plan') || '기본 플랜';

  // 결제 페이지 진입 시 하단바 숨기기
  useEffect(() => {
    setHideTabBar(true);
    return () => {
      setHideTabBar(false);
    };
  }, [setHideTabBar]);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [cardCompany, setCardCompany] = useState<string>('');
  const [easyPayProvider, setEasyPayProvider] = useState<EasyPayProvider | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTermsSheet, setShowTermsSheet] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const processPayment = useProcessPayment();

  // 다음 결제일 계산 (현재 날짜 + 1개월)
  const nextPaymentDate = useMemo(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).replace(/\./g, '.').replace(/\s/g, '');
  }, []);

  // 결제 수단 선택 시 유효성 검사
  const isPaymentMethodValid = () => {
    if (!paymentMethod) return false;
    if (paymentMethod === 'card' && !cardCompany) return false;
    if (paymentMethod === 'easy_pay' && !easyPayProvider) return false;
    return true;
  };

  // 버튼 활성화 조건: 결제 수단이 선택되어 있고 유효한 경우
  const isButtonEnabled = isPaymentMethodValid();

  const handlePaymentClick = () => {
    // 결제 수단 유효성 검사
    if (!isPaymentMethodValid()) {
      if (paymentMethod === 'card' && !cardCompany) {
        alert('카드사를 선택해주세요');
        return;
      }
      if (paymentMethod === 'easy_pay' && !easyPayProvider) {
        alert('간편결제 서비스를 선택해주세요');
        return;
      }
      return;
    }

    // 약관 동의 시트 표시
    setShowTermsSheet(true);
  };

  const handleTermsAgreed = (agreed: boolean) => {
    if (agreed) {
      // 약관 동의 후 결제 확인 모달 표시
      setShowTermsSheet(false);
      setShowConfirmModal(true);
    }
  };

  const handleConfirmPayment = async () => {
    if (!paymentMethod) {
      alert('결제 수단을 선택해주세요.');
      return;
    }

    setIsProcessing(true);
    setShowConfirmModal(false);

    try {
      const paymentData = {
        amount: parseFloat(amount),
        planName,
        paymentMethod: paymentMethod as PaymentMethod, // null 체크 후 타입 단언
        cardCompany: paymentMethod === 'card' ? cardCompany : undefined,
        easyPayProvider: paymentMethod === 'easy_pay' ? (easyPayProvider || undefined) : undefined,
      };

      const result = await processPayment.mutateAsync(paymentData);

      if (result.success) {
        navigate('/payment/success');
      } else {
        alert('결제에 실패했습니다. 다시 시도해주세요.');
      }
    } catch (error) {
      console.error('Payment error:', error);
      alert('결제 처리 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const cardCompanies = [
    '신한카드',
    'KB국민카드',
    '하나카드',
    '삼성카드',
    '현대카드',
    '롯데카드',
    'NH농협카드',
    'BC카드',
  ];

  return (
    <div className="min-h-screen bg-white pb-32">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[#4A2C1A]" />
          </button>
          <h1 className="text-lg font-semibold text-[#4A2C1A]">구독 결제</h1>
          <div className="w-10" /> {/* Spacer */}
        </div>

        <div className="px-4 py-6 space-y-6">
          {/* Plan Benefits */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-700">플랜혜택</span>
              <div className="flex items-center gap-2">
                <img
                  src="/mureka_logo.png"
                  alt="Mureka"
                  className="h-3 w-auto"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            </div>

            <div className="space-y-4">
              {/* Benefit 1 */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-[#4A2C1A] mb-1">
                    일기 무제한 작성 · 저장
                  </h3>
                </div>
              </div>

              {/* Benefit 2 */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-[#4A2C1A] mb-1">
                    Ai 분석 기반 가사 생성
                  </h3>
                </div>
              </div>

              {/* Benefit 3 */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Headphones className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-[#4A2C1A] mb-1">
                    음악 생성 (Mureka)
                  </h3>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Info */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-[#4A2C1A]">결제정보</h2>
              <span className="text-sm text-gray-600">다음 결제일 : {nextPaymentDate}</span>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">플랜</span>
                <span className="text-sm font-medium text-[#4A2C1A]">{planName}</span>
              </div>
              <div className="border-t border-gray-200"></div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">금액</span>
                <span className="text-base font-bold text-[#4A2C1A]">
                  {parseInt(amount).toLocaleString()}원
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-600 mt-3">
              구독은 매월 자동 갱신되며, 다음 결제일 전까지 언제든지 해지할 수 있습니다.
            </p>
          </div>

          {/* Payment Method Selection */}
          <div>
            <h2 className="text-base font-semibold text-[#4A2C1A] mb-4">결제수단</h2>

            {/* Credit/Debit Card */}
            <div className="space-y-3 mb-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="card"
                  checked={paymentMethod === 'card'}
                  onChange={(e) => {
                    setPaymentMethod(e.target.value as PaymentMethod);
                    setCardCompany(''); // 카드사 초기화
                  }}
                  className="w-5 h-5 text-[#665146] focus:ring-[#665146]"
                />
                <span className="font-medium text-[#4A2C1A]">신용/체크카드</span>
              </label>

              {paymentMethod === 'card' && (
                <div className="ml-8 relative">
                  <div className="bg-gray-50 rounded-lg px-3 py-2 flex items-center justify-between pointer-events-none">
                    <span className="text-sm text-gray-600">
                      {cardCompany || '카드사 선택'}
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </div>
                  <select
                    id="cardCompany"
                    value={cardCompany}
                    onChange={(e) => setCardCompany(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  >
                    <option value="">카드사 선택</option>
                    {cardCompanies.map((company) => (
                      <option key={company} value={company}>
                        {company}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Easy Payment */}
            <div className="space-y-3 mb-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="easy_pay"
                  checked={paymentMethod === 'easy_pay'}
                  onChange={(e) => {
                    setPaymentMethod(e.target.value as PaymentMethod);
                    setEasyPayProvider(null); // 간편결제 초기화
                  }}
                  className="w-5 h-5 text-[#665146] focus:ring-[#665146]"
                />
                <span className="font-medium text-[#4A2C1A]">간편결제</span>
              </label>
            </div>

            {/* Bank Transfer */}
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="bank_transfer"
                  checked={paymentMethod === 'bank_transfer'}
                  onChange={(e) => {
                    setPaymentMethod(e.target.value as PaymentMethod);
                    setCardCompany(''); // 초기화
                    setEasyPayProvider(null); // 초기화
                  }}
                  className="w-5 h-5 text-[#665146] focus:ring-[#665146]"
                />
                <span className="font-medium text-[#4A2C1A]">계좌이체</span>
              </label>
            </div>
          </div>
        </div>

        {/* Bottom Fixed Section */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4">
          <div className="max-w-md mx-auto">
            <p className="text-xs text-gray-600 text-center mb-3">
              결제 버튼을 누르면 구독이 시작되며, 매월 자동 결제됩니다.
            </p>
            <button
              onClick={handlePaymentClick}
              disabled={isProcessing || processPayment.isPending || !isButtonEnabled}
              className="w-full py-4 px-4 rounded-full bg-[#665146] hover:bg-[#5A453A] text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing || processPayment.isPending
                ? '결제 처리 중...'
                : `월 ${parseInt(amount).toLocaleString()}원으로 시작하기`}
            </button>
          </div>
        </div>
      </div>

      {/* Terms Sheet */}
      <PaymentTermsSheet
        isOpen={showTermsSheet}
        onClose={() => setShowTermsSheet(false)}
        onAgree={handleTermsAgreed}
      />

      {/* Payment Confirm Modal */}
      <PaymentConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmPayment}
        amount={parseInt(amount)}
      />
    </div>
  );
}
