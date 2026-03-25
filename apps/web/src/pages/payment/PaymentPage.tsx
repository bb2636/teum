import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, BookOpen, FileText, Headphones } from 'lucide-react';
import { useInitPayment } from '@/hooks/usePayment';
import { PaymentTermsSheet } from '@/components/PaymentTermsSheet';
import { PaymentConfirmModal } from '@/components/PaymentConfirmModal';
import { useHideTabBar } from '@/contexts/HideTabBarContext';

declare global {
  interface Window {
    AUTHNICE?: {
      requestPay: (params: Record<string, unknown>) => void;
    };
  }
}

type PaymentMethod = 'CARD' | 'BANK' | 'CELLPHONE';

const NICEPAY_CARD_COMPANIES = [
  { code: '06', name: '신한카드' },
  { code: '02', name: 'KB국민카드' },
  { code: '03', name: '하나카드' },
  { code: '04', name: '삼성카드' },
  { code: '07', name: '현대카드' },
  { code: '08', name: '롯데카드' },
  { code: '12', name: 'NH농협카드' },
  { code: '01', name: 'BC카드' },
  { code: '15', name: '우리카드' },
  { code: '11', name: '씨티카드' },
];

export function PaymentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setHideTabBar } = useHideTabBar();
  const amount = searchParams.get('amount') || '0';
  const planName = searchParams.get('plan') || '기본 플랜';

  useEffect(() => {
    setHideTabBar(true);
    return () => {
      setHideTabBar(false);
    };
  }, [setHideTabBar]);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [cardCode, setCardCode] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTermsSheet, setShowTermsSheet] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const initPayment = useInitPayment();

  const nextPaymentDate = useMemo(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).replace(/\./g, '.').replace(/\s/g, '');
  }, []);

  const isPaymentMethodValid = () => {
    if (!paymentMethod) return false;
    if (paymentMethod === 'CARD' && !cardCode) return false;
    return true;
  };

  const isButtonEnabled = isPaymentMethodValid();

  const handlePaymentClick = () => {
    if (!isPaymentMethodValid()) {
      if (paymentMethod === 'CARD' && !cardCode) {
        alert('카드사를 선택해주세요');
        return;
      }
      return;
    }
    setShowTermsSheet(true);
  };

  const handleTermsAgreed = (agreed: boolean) => {
    if (agreed) {
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
      const initResult = await initPayment.mutateAsync({
        amount: parseFloat(amount),
        planName,
        paymentMethod,
      });

      if (!window.AUTHNICE) {
        alert('나이스페이 결제 모듈을 불러오지 못했습니다. 페이지를 새로고침해주세요.');
        setIsProcessing(false);
        return;
      }

      const payParams: Record<string, unknown> = {
        clientId: initResult.clientId,
        method: initResult.method,
        orderId: initResult.orderId,
        amount: initResult.amount,
        goodsName: initResult.goodsName,
        returnUrl: initResult.returnUrl,
        fnError: (result: { errorMsg?: string }) => {
          setIsProcessing(false);
          alert(result.errorMsg || '결제 중 오류가 발생했습니다.');
        },
      };

      if (paymentMethod === 'CARD' && cardCode) {
        payParams.cardCode = cardCode;
      }

      window.AUTHNICE.requestPay(payParams);
    } catch (error: any) {
      console.error('Payment init error:', error);
      alert(error?.message || '결제 초기화 중 오류가 발생했습니다.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-white pb-32">
      <div className="max-w-md mx-auto">
        <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[#4A2C1A]" />
          </button>
          <h1 className="text-lg font-semibold text-[#4A2C1A]">구독 결제</h1>
          <div className="w-10" />
        </div>

        <div className="px-4 py-6 space-y-6">
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

          <div>
            <h2 className="text-base font-semibold text-[#4A2C1A] mb-4">결제수단</h2>

            <div className="space-y-3 mb-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="CARD"
                  checked={paymentMethod === 'CARD'}
                  onChange={(e) => {
                    setPaymentMethod(e.target.value as PaymentMethod);
                    setCardCode('');
                  }}
                  className="w-5 h-5 text-[#665146] focus:ring-[#665146]"
                />
                <span className="font-medium text-[#4A2C1A]">신용/체크카드</span>
              </label>

              {paymentMethod === 'CARD' && (
                <div className="ml-8 relative">
                  <div className="bg-gray-50 rounded-lg px-3 py-2 flex items-center justify-between pointer-events-none">
                    <span className="text-sm text-gray-600">
                      {NICEPAY_CARD_COMPANIES.find(c => c.code === cardCode)?.name || '카드사 선택'}
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </div>
                  <select
                    value={cardCode}
                    onChange={(e) => setCardCode(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  >
                    <option value="">카드사 선택</option>
                    {NICEPAY_CARD_COMPANIES.map((card) => (
                      <option key={card.code} value={card.code}>
                        {card.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="space-y-3 mb-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="BANK"
                  checked={paymentMethod === 'BANK'}
                  onChange={(e) => {
                    setPaymentMethod(e.target.value as PaymentMethod);
                    setCardCode('');
                  }}
                  className="w-5 h-5 text-[#665146] focus:ring-[#665146]"
                />
                <span className="font-medium text-[#4A2C1A]">계좌이체</span>
              </label>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="CELLPHONE"
                  checked={paymentMethod === 'CELLPHONE'}
                  onChange={(e) => {
                    setPaymentMethod(e.target.value as PaymentMethod);
                    setCardCode('');
                  }}
                  className="w-5 h-5 text-[#665146] focus:ring-[#665146]"
                />
                <span className="font-medium text-[#4A2C1A]">휴대폰 결제</span>
              </label>
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4">
          <div className="max-w-md mx-auto">
            <p className="text-xs text-gray-600 text-center mb-3">
              결제 버튼을 누르면 나이스페이 결제창이 열립니다.
            </p>
            <button
              onClick={handlePaymentClick}
              disabled={isProcessing || initPayment.isPending || !isButtonEnabled}
              className="w-full py-4 px-4 rounded-full bg-[#665146] hover:bg-[#5A453A] text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing || initPayment.isPending
                ? '결제 처리 중...'
                : `월 ${parseInt(amount).toLocaleString()}원으로 시작하기`}
            </button>
          </div>
        </div>
      </div>

      <PaymentTermsSheet
        isOpen={showTermsSheet}
        onClose={() => setShowTermsSheet(false)}
        onAgree={handleTermsAgreed}
      />

      <PaymentConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmPayment}
        amount={parseInt(amount)}
      />
    </div>
  );
}
