import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useSupportInquiries } from '@/hooks/useSupport';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export function SupportPage() {
  const navigate = useNavigate();
  const { data: inquiries = [], isLoading } = useSupportInquiries();
  const [expandedInquiryId, setExpandedInquiryId] = useState<string | null>(null);

  const getStatusText = (status: string) => {
    switch (status) {
      case 'answered':
        return '답변 완료';
      case 'in_progress':
        return '처리 중';
      default:
        return '답변 대기';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'answered':
        return 'text-gray-500';
      case 'in_progress':
        return 'text-gray-500';
      default:
        return 'text-gray-500';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="max-w-md mx-auto">
        {/* Header - 고정 */}
        <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[#4A2C1A]" />
          </button>
          <h1 className="text-lg font-semibold text-[#4A2C1A]">고객 지원</h1>
          <div className="w-10" /> {/* Spacer */}
        </div>

        <div className="px-4 py-6">
          {/* 문의 목록 */}
          <div className="space-y-0">
            {inquiries.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">문의 내역이 없습니다</p>
            ) : (
              inquiries.map((inquiry, index) => {
                const isExpanded = expandedInquiryId === inquiry.id;
                const hasAnswer = inquiry.answer && inquiry.answer.trim().length > 0;

                return (
                  <div key={inquiry.id}>
                    <button
                      onClick={() => {
                        setExpandedInquiryId(isExpanded ? null : inquiry.id);
                      }}
                      className="w-full py-4 text-left"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[#4A2C1A] mb-1">{inquiry.subject}</p>
                          <p className={`text-sm ${getStatusColor(inquiry.status)}`}>
                            {getStatusText(inquiry.status)} · {format(new Date(inquiry.createdAt), 'yyyy.MM.dd', { locale: ko })}
                          </p>
                        </div>
                      </div>
                    </button>

                    {/* 확장된 문의 내용 */}
                    {isExpanded && (
                      <div className="pb-4">
                        <div className="bg-gray-100 rounded-lg p-4 space-y-4">
                          {/* Q: 문의 내용 */}
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-[#665146] flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-white text-xs font-bold">Q</span>
                            </div>
                            <p className="text-sm text-gray-700 flex-1 leading-relaxed">{inquiry.message}</p>
                          </div>

                          {/* A: 답변 내용 */}
                          {hasAnswer && (
                            <div className="flex items-start gap-3">
                              <div className="w-6 h-6 rounded-full bg-[#665146] flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-white text-xs font-bold">A</span>
                              </div>
                              <p className="text-sm text-gray-700 flex-1 leading-relaxed">{inquiry.answer}</p>
                            </div>
                          )}

                          {/* 날짜 */}
                          <div className="text-right pt-2">
                            <p className="text-xs text-gray-500">
                              {format(new Date(inquiry.createdAt), 'yyyy.MM.dd', { locale: ko })}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 구분선 */}
                    {index < inquiries.length - 1 && (
                      <div className="border-b border-gray-200" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 하단 고정 버튼 */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
          <button
            onClick={() => navigate('/my/support/inquiry')}
            className="w-full py-3 px-4 rounded-lg bg-[#665146] hover:bg-[#5A453A] text-white font-medium transition-colors"
          >
            1:1 문의
          </button>
        </div>
      </div>
    </div>
  );
}
