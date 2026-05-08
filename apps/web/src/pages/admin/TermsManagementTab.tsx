import { useState, useEffect, useRef } from 'react';
import { t } from '@/lib/i18n';
import { 
  useServiceTerms, 
  usePrivacyPolicy,
  usePaymentTerms,
  useRefundTerms,
  useUpdateServiceTerms, 
  useUpdatePrivacyPolicy,
  useUpdatePaymentTerms,
  useUpdateRefundTerms,
} from '@/hooks/useTerms';
import { FileText, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdminConfirmModal } from './AdminConfirmModal';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

type TermsType = 'service' | 'privacy' | 'payment' | 'refund';

export function TermsManagementTab() {
  const [selectedType, setSelectedType] = useState<TermsType>('service');
  const [content, setContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isFirstSave, setIsFirstSave] = useState(false);
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastContentRef = useRef('');

  const serviceTerms = useServiceTerms();
  const privacyTerms = usePrivacyPolicy();
  const paymentTerms = usePaymentTerms();
  const refundTerms = useRefundTerms();
  const updateServiceTerms = useUpdateServiceTerms();
  const updatePrivacyTerms = useUpdatePrivacyPolicy();
  const updatePaymentTerms = useUpdatePaymentTerms();
  const updateRefundTerms = useUpdateRefundTerms();

  const currentTerms = 
    selectedType === 'service' ? serviceTerms :
    selectedType === 'privacy' ? privacyTerms :
    selectedType === 'payment' ? paymentTerms :
    refundTerms;
  
  const updateMutation = 
    selectedType === 'service' ? updateServiceTerms :
    selectedType === 'privacy' ? updatePrivacyTerms :
    selectedType === 'payment' ? updatePaymentTerms :
    updateRefundTerms;

  // Load content when terms data changes or type changes
  useEffect(() => {
    if (currentTerms.data) {
      setContent(currentTerms.data.content || '');
      lastContentRef.current = currentTerms.data.content || '';
      setHasChanges(false);
      setIsFirstSave(!currentTerms.data.updatedAt);
    }
  }, [currentTerms.data, selectedType]);

  // Auto-save after 10 seconds of no typing
  useEffect(() => {
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }

    if (content.trim() && content !== lastContentRef.current) {
      let cancelled = false;
      autoSaveTimer.current = setTimeout(async () => {
        if (cancelled) return;
        try {
          await updateMutation.mutateAsync({ content, autoSave: true });
          if (cancelled) return;
          setLastAutoSave(new Date());
          lastContentRef.current = content;
          setHasChanges(false);
        } catch (error) {
          console.error('Auto-save failed:', error);
        }
      }, 10000);
      return () => {
        cancelled = true;
        if (autoSaveTimer.current) {
          clearTimeout(autoSaveTimer.current);
        }
      };
    }

    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, [content, updateMutation]);

  const handleContentChange = (value: string) => {
    setContent(value);
    setHasChanges(value !== lastContentRef.current);
  };

  const handleSave = () => {
    if (!content.trim()) return;
    setShowSaveModal(true);
  };

  const handleConfirmSave = async () => {
    if (!content.trim()) return;
    
    try {
      await updateMutation.mutateAsync({ content, autoSave: false });
      setShowSaveModal(false);
      setShowSuccessModal(true);
      lastContentRef.current = content;
      setHasChanges(false);
      setIsFirstSave(false);
      // Refresh to get updated version
      if (selectedType === 'service') {
        serviceTerms.refetch();
      } else if (selectedType === 'privacy') {
        privacyTerms.refetch();
      } else if (selectedType === 'payment') {
        paymentTerms.refetch();
      } else {
        refundTerms.refetch();
      }
    } catch (error) {
      console.error('Failed to save terms:', error);
      alert('약관 저장에 실패했습니다.');
    }
  };

  const handleCloseSaveModal = () => {
    setShowSaveModal(false);
  };

  const handleCloseSuccessModal = () => {
    setShowSuccessModal(false);
  };

  const getTermsTitle = (type: TermsType) => {
    switch (type) {
      case 'service':
        return '서비스 이용약관';
      case 'privacy':
        return '개인정보 처리방침';
      case 'payment':
        return '정기결제/자동갱신';
      case 'refund':
        return '환불/취소 정책';
      default:
        return '';
    }
  };

  const getTermsIcon = () => {
    return <FileText className="w-5 h-5" />;
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#4A2C1A] mb-2">약관 관리</h2>
          <p className="text-sm text-gray-600">서비스 이용약관, 개인정보 처리방침, 정기결제/자동갱신, 환불/취소 정책을 관리합니다.</p>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Left Navigation */}
        <div className="w-72 flex-shrink-0 space-y-4">
          {/* Service Terms Card */}
          <button
            onClick={() => setSelectedType('service')}
            className={`w-full p-5 rounded-lg border-2 transition-all text-left ${
              selectedType === 'service'
                ? 'border-[#4A2C1A] bg-[#F5EFEA]'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`${selectedType === 'service' ? 'text-[#4A2C1A]' : 'text-gray-400'}`}>
                {getTermsIcon()}
              </div>
              <h3 className="font-semibold text-[#4A2C1A]">서비스 이용약관</h3>
            </div>
            {serviceTerms.data?.updatedAt && (
              <p className="text-xs text-gray-500">
                최종 수정: {format(new Date(serviceTerms.data.updatedAt), 'yyyy.MM.dd', { locale: ko })}
              </p>
            )}
          </button>

          {/* Privacy Policy Card */}
          <button
            onClick={() => setSelectedType('privacy')}
            className={`w-full p-5 rounded-lg border-2 transition-all text-left ${
              selectedType === 'privacy'
                ? 'border-[#4A2C1A] bg-[#F5EFEA]'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`${selectedType === 'privacy' ? 'text-[#4A2C1A]' : 'text-gray-400'}`}>
                {getTermsIcon()}
              </div>
              <h3 className="font-semibold text-[#4A2C1A]">개인정보 처리방침</h3>
            </div>
            {privacyTerms.data?.updatedAt && (
              <p className="text-xs text-gray-500">
                최종 수정: {format(new Date(privacyTerms.data.updatedAt), 'yyyy.MM.dd', { locale: ko })}
              </p>
            )}
          </button>

          {/* Payment Terms Card */}
          <button
            onClick={() => setSelectedType('payment')}
            className={`w-full p-5 rounded-lg border-2 transition-all text-left ${
              selectedType === 'payment'
                ? 'border-[#4A2C1A] bg-[#F5EFEA]'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`${selectedType === 'payment' ? 'text-[#4A2C1A]' : 'text-gray-400'}`}>
                {getTermsIcon()}
              </div>
              <h3 className="font-semibold text-[#4A2C1A]">정기결제/자동갱신</h3>
            </div>
            {paymentTerms.data?.updatedAt && (
              <p className="text-xs text-gray-500">
                최종 수정: {format(new Date(paymentTerms.data.updatedAt), 'yyyy.MM.dd', { locale: ko })}
              </p>
            )}
          </button>

          {/* Refund Terms Card */}
          <button
            onClick={() => setSelectedType('refund')}
            className={`w-full p-5 rounded-lg border-2 transition-all text-left ${
              selectedType === 'refund'
                ? 'border-[#4A2C1A] bg-[#F5EFEA]'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`${selectedType === 'refund' ? 'text-[#4A2C1A]' : 'text-gray-400'}`}>
                {getTermsIcon()}
              </div>
              <h3 className="font-semibold text-[#4A2C1A]">환불/취소 정책</h3>
            </div>
            {refundTerms.data?.updatedAt && (
              <p className="text-xs text-gray-500">
                최종 수정: {format(new Date(refundTerms.data.updatedAt), 'yyyy.MM.dd', { locale: ko })}
              </p>
            )}
          </button>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 bg-white rounded-lg border border-gray-200 p-8">
          {currentTerms.isLoading ? (
            <div className="text-center py-12 text-gray-500">{t('common.loading')}</div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <h3 className="text-lg font-semibold text-[#4A2C1A]">
                    {getTermsTitle(selectedType)} {currentTerms.data?.version ? `v${currentTerms.data.version}` : 'v1.0'}
                  </h3>
                  {currentTerms.data?.updatedAt && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      <Check className="w-4 h-4 text-green-500" />
                      <span>저장됨: {format(new Date(currentTerms.data.updatedAt), 'yyyy.MM.dd', { locale: ko })}</span>
                    </div>
                  )}
                  {lastAutoSave && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      <span className="text-xs">(자동 저장: {format(lastAutoSave, 'HH:mm:ss', { locale: ko })})</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleSave}
                    disabled={!content.trim() || !hasChanges || updateMutation.isPending}
                    className={`rounded-lg ${
                      content.trim() && hasChanges && !updateMutation.isPending
                        ? 'bg-[#4A2C1A] text-white hover:bg-[#3A2010]'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    저장하기
                  </Button>
                </div>
              </div>

              {/* Content Editor */}
              <textarea
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="약관 내용을 입력하세요"
                className="w-full h-[600px] px-5 py-4 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#4A2C1A] focus:border-transparent font-mono text-sm leading-relaxed"
              />
            </>
          )}
        </div>
      </div>

      {/* Save Confirmation Modal */}
      <AdminConfirmModal
        isOpen={showSaveModal}
        title="변경사항을 저장하시겠습니까?"
        confirmText="저장"
        loadingText="저장 중..."
        onConfirm={handleConfirmSave}
        onClose={handleCloseSaveModal}
        isLoading={updateMutation.isPending}
      />

      {/* Success Modal */}
      <AdminConfirmModal
        isOpen={showSuccessModal}
        title={isFirstSave ? '약관이 저장되었습니다' : '약관이 수정되었습니다'}
        confirmText="완료"
        variant="alert"
        onConfirm={handleCloseSuccessModal}
        onClose={handleCloseSuccessModal}
      />
    </div>
  );
}
