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
import { FileText, Check, Languages, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { apiRequest } from '@/lib/api';

type TermsType = 'service' | 'privacy' | 'payment' | 'refund';
type TranslateLang = 'en' | 'ja' | 'zh';

const TRANSLATE_LANGS: { code: TranslateLang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
];

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
  const [showTranslatePanel, setShowTranslatePanel] = useState(false);
  const [translateLang, setTranslateLang] = useState<TranslateLang>('en');
  const [translatedContent, setTranslatedContent] = useState('');
  const [translatedTitle, setTranslatedTitle] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);

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

  const handleTranslate = async () => {
    if (!content.trim()) return;
    setIsTranslating(true);
    setTranslatedContent('');
    setTranslatedTitle('');
    try {
      const result = await apiRequest<{ data: { title?: string; content: string } }>('/terms/translate', {
        method: 'POST',
        body: JSON.stringify({
          title: getTermsTitle(selectedType),
          content,
          lang: translateLang,
          type: selectedType,
        }),
      });
      setTranslatedTitle(result.data.title || '');
      setTranslatedContent(result.data.content || '');
    } catch (error) {
      console.error('Translation failed:', error);
      alert('번역에 실패했습니다.');
    } finally {
      setIsTranslating(false);
    }
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
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`${selectedType === 'service' ? 'text-purple-600' : 'text-gray-400'}`}>
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
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`${selectedType === 'privacy' ? 'text-purple-600' : 'text-gray-400'}`}>
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
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`${selectedType === 'payment' ? 'text-purple-600' : 'text-gray-400'}`}>
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
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`${selectedType === 'refund' ? 'text-purple-600' : 'text-gray-400'}`}>
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
                    onClick={() => {
                      setShowTranslatePanel(!showTranslatePanel);
                      setTranslatedContent('');
                      setTranslatedTitle('');
                    }}
                    variant="outline"
                    className={`rounded-lg flex items-center gap-1.5 ${showTranslatePanel ? 'border-purple-500 text-purple-600' : ''}`}
                    disabled={!content.trim()}
                  >
                    <Languages className="w-4 h-4" />
                    번역
                  </Button>
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

              {showTranslatePanel && (
                <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-sm font-medium text-gray-700">번역 언어:</span>
                    <div className="flex gap-2">
                      {TRANSLATE_LANGS.map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => {
                            setTranslateLang(lang.code);
                            setTranslatedContent('');
                            setTranslatedTitle('');
                          }}
                          className={`px-3 py-1 text-sm rounded-full transition-colors ${
                            translateLang === lang.code
                              ? 'bg-purple-600 text-white'
                              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                          }`}
                        >
                          {lang.label}
                        </button>
                      ))}
                    </div>
                    <Button
                      onClick={handleTranslate}
                      disabled={isTranslating || !content.trim()}
                      className="ml-auto bg-purple-600 text-white hover:bg-purple-700 rounded-lg text-sm"
                      size="sm"
                    >
                      {isTranslating ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          번역 중...
                        </>
                      ) : '번역하기'}
                    </Button>
                  </div>
                  {translatedContent && (
                    <div className="mt-3">
                      {translatedTitle && (
                        <h4 className="text-sm font-semibold text-gray-800 mb-2">{translatedTitle}</h4>
                      )}
                      <textarea
                        value={translatedContent}
                        readOnly
                        className="w-full h-[300px] px-4 py-3 border border-purple-200 rounded-lg resize-none bg-white font-mono text-sm leading-relaxed text-gray-700"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Content Editor */}
              <textarea
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="약관 내용을 입력하세요"
                className={`w-full ${showTranslatePanel ? 'h-[350px]' : 'h-[600px]'} px-5 py-4 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#4A2C1A] focus:border-transparent font-mono text-sm leading-relaxed`}
              />
            </>
          )}
        </div>
      </div>

      {/* Save Confirmation Modal */}
      {showSaveModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50 animate-overlay-fade" onClick={handleCloseSaveModal} />
          <div className="fixed inset-0 flex items-center justify-center z-[60] pointer-events-none">
            <div
              className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4 p-6 pointer-events-auto text-center animate-modal-pop"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-base font-medium text-[#4A2C1A] mb-6">
                변경사항을 저장하시겠습니까?
              </p>
              <div className="flex items-center justify-center gap-3">
                <Button
                  onClick={handleCloseSaveModal}
                  variant="outline"
                  className="border-0 text-gray-700 hover:bg-gray-50 rounded-full"
                >
                  취소
                </Button>
                <Button
                  onClick={handleConfirmSave}
                  disabled={updateMutation.isPending}
                  className="bg-purple-600 text-white hover:bg-purple-700"
                >
                  {updateMutation.isPending ? '저장 중...' : '저장'}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50 animate-overlay-fade" onClick={handleCloseSuccessModal} />
          <div className="fixed inset-0 flex items-center justify-center z-[60] pointer-events-none">
            <div
              className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4 p-6 pointer-events-auto animate-modal-pop"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-base font-medium text-[#4A2C1A] mb-6 text-center">
                {isFirstSave ? '약관이 저장되었습니다' : '약관이 수정되었습니다'}
              </p>
              <div className="flex items-center justify-center">
                <Button
                  onClick={handleCloseSuccessModal}
                  className="bg-purple-600 text-white hover:bg-purple-700"
                >
                  완료
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
