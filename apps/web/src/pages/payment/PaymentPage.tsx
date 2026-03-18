import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CreditCard, Smartphone, Building2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useProcessPayment } from '@/hooks/usePayment';
import { PaymentTermsSheet } from '@/components/PaymentTermsSheet';
import { PaymentConfirmModal } from '@/components/PaymentConfirmModal';

type PaymentMethod = 'card' | 'easy_pay' | 'bank_transfer';
type EasyPayProvider = 'toss' | 'npay' | 'apple';

export function PaymentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const amount = searchParams.get('amount') || '0';
  const planName = searchParams.get('plan') || '기본 플랜';

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [cardCompany, setCardCompany] = useState<string>('');
  const [easyPayProvider, setEasyPayProvider] = useState<EasyPayProvider | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTermsSheet, setShowTermsSheet] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);

  const processPayment = useProcessPayment();

  const handlePaymentClick = () => {
    if (!termsAgreed) {
      setShowTermsSheet(true);
      return;
    }

    if (paymentMethod === 'card' && !cardCompany) {
      alert('카드사를 선택해주세요');
      return;
    }

    if (paymentMethod === 'easy_pay' && !easyPayProvider) {
      alert('간편결제 서비스를 선택해주세요');
      return;
    }

    setShowConfirmModal(true);
  };

  const handleConfirmPayment = async () => {
    setIsProcessing(true);
    setShowConfirmModal(false);

    try {
      const paymentData = {
        amount: parseFloat(amount),
        planName,
        paymentMethod,
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
    <div className="min-h-screen bg-beige-50 pb-20">
      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-brown-900">구독 결제</h1>
          <div className="w-10" /> {/* Spacer */}
        </div>

        {/* Plan Benefits */}
        <div className="bg-gray-50 rounded-xl p-4 shadow-sm">
          <div className="mb-3">
            <span className="font-semibold text-brown-900">Mureka</span>
          </div>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>• 무제한 일기 작성 및 저장</li>
            <li>• AI 분석 기반 가사 생성</li>
            <li>• 음악 생성 (Mureka)</li>
          </ul>
        </div>

        {/* Payment Info */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">다음 결제일</span>
            <span className="text-sm text-muted-foreground">2026.00.00</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">플랜</span>
            <span className="font-semibold text-brown-900">{planName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">결제 금액</span>
            <span className="text-lg font-bold text-brown-900">
              {parseInt(amount).toLocaleString()}원
            </span>
          </div>
        </div>

        {/* Payment Method Selection */}
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-brown-900">결제수단</h2>

          {/* Credit/Debit Card */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="paymentMethod"
                value="card"
                checked={paymentMethod === 'card'}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-5 h-5 text-brown-600 focus:ring-brown-500"
              />
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-brown-600" />
                <span className="font-medium text-brown-900">신용/체크카드</span>
              </div>
            </label>

            {paymentMethod === 'card' && (
              <div className="ml-8 space-y-2">
                <Label htmlFor="cardCompany" className="text-sm text-muted-foreground">
                  카드사 선택
                </Label>
                <div className="relative">
                  <select
                    id="cardCompany"
                    value={cardCompany}
                    onChange={(e) => setCardCompany(e.target.value)}
                    className="w-full px-3 py-2 border border-brown-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brown-500 appearance-none bg-white"
                  >
                    <option value="">카드사 선택</option>
                    {cardCompanies.map((company) => (
                      <option key={company} value={company}>
                        {company}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            )}
          </div>

          {/* Easy Payment */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="paymentMethod"
                value="easy_pay"
                checked={paymentMethod === 'easy_pay'}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-5 h-5 text-brown-600 focus:ring-brown-500"
              />
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-brown-600" />
                <span className="font-medium text-brown-900">간편결제</span>
              </div>
            </label>

            {paymentMethod === 'easy_pay' && (
              <div className="ml-8 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEasyPayProvider('toss')}
                    className={`px-3 py-3 rounded-lg border-2 transition-colors ${
                      easyPayProvider === 'toss'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-brown-200 bg-white hover:bg-brown-50'
                    }`}
                  >
                    <div className="text-xs font-medium text-center">toss pay</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEasyPayProvider('npay')}
                    className={`px-3 py-3 rounded-lg border-2 transition-colors ${
                      easyPayProvider === 'npay'
                        ? 'border-green-500 bg-green-50'
                        : 'border-brown-200 bg-white hover:bg-brown-50'
                    }`}
                  >
                    <div className="text-xs font-medium text-center">N pay</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEasyPayProvider('apple')}
                    className={`px-3 py-3 rounded-lg border-2 transition-colors ${
                      easyPayProvider === 'apple'
                        ? 'border-gray-800 bg-gray-50'
                        : 'border-brown-200 bg-white hover:bg-brown-50'
                    }`}
                  >
                    <div className="text-xs font-medium text-center">Pay</div>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bank Transfer */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="paymentMethod"
                value="bank_transfer"
                checked={paymentMethod === 'bank_transfer'}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-5 h-5 text-brown-600 focus:ring-brown-500"
              />
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-brown-600" />
                <span className="font-medium text-brown-900">실시간 계좌이체</span>
              </div>
            </label>
          </div>
        </div>

        {/* Test Payment Notice */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-xs text-yellow-800">
            ⚠️ 현재 테스트 모드입니다. 실제 결제가 발생하지 않습니다.
          </p>
        </div>

        {/* Payment Button */}
        <Button
          onClick={handlePaymentClick}
          disabled={isProcessing || processPayment.isPending || !termsAgreed}
          className="w-full bg-brown-600 hover:bg-brown-700 text-white py-6 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing || processPayment.isPending
            ? '결제 처리 중...'
            : `월 ${parseInt(amount).toLocaleString()}원으로 시작하기`}
        </Button>
      </div>

      {/* Terms Sheet */}
      <PaymentTermsSheet
        isOpen={showTermsSheet}
        onClose={() => setShowTermsSheet(false)}
        onAgree={(agreed) => {
          setTermsAgreed(agreed);
        }}
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
