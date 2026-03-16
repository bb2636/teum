import { useState } from 'react';
import { useAllSupportInquiries } from '@/hooks/useSupport';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { SupportInquiryDetailModal } from './SupportInquiryDetailModal';

type SupportFilter = 'all' | 'waiting' | 'answered';

export function SupportManagementTab() {
  const { data: inquiries = [], isLoading } = useAllSupportInquiries();
  const [filter, setFilter] = useState<SupportFilter>('all');
  const [selectedInquiryId, setSelectedInquiryId] = useState<string | null>(null);

  // Filter inquiries by status
  const filteredInquiries = inquiries.filter((inquiry) => {
    if (filter === 'all') return true;
    if (filter === 'waiting') return inquiry.status === 'received' || inquiry.status === 'in_progress';
    if (filter === 'answered') return inquiry.status === 'answered';
    return true;
  });

  const getStatusLabel = (status: string) => {
    if (status === 'answered') return '답변 완료';
    return '답변 대기';
  };

  const getStatusColor = (status: string) => {
    if (status === 'answered') {
      return 'bg-green-100 text-green-700';
    }
    return 'bg-orange-100 text-orange-700';
  };

  const getStatusDotColor = (status: string) => {
    if (status === 'answered') {
      return 'bg-green-500';
    }
    return 'bg-orange-500';
  };

  if (isLoading) {
    return <div className="p-6 text-center text-gray-500">로딩 중...</div>;
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[#4A2C1A] mb-2">고객센터</h2>
        <p className="text-sm text-gray-600">사용자들의 1:1 문의를 확인하고 답변할 수 있습니다.</p>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-[#4A2C1A] text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          전체
        </button>
        <button
          onClick={() => setFilter('waiting')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            filter === 'waiting'
              ? 'bg-[#4A2C1A] text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          답변 대기
        </button>
        <button
          onClick={() => setFilter('answered')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            filter === 'answered'
              ? 'bg-[#4A2C1A] text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          답변 완료
        </button>
      </div>

      {/* Count */}
      <div className="mb-4 text-sm text-gray-600">
        전체 {filteredInquiries.length}개
      </div>

      {/* Inquiries Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 w-32">
                상태
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                제목
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 w-64">
                작성자
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 w-32">
                작성일
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredInquiries.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  등록된 문의가 없습니다.
                </td>
              </tr>
            ) : (
              filteredInquiries.map((inquiry) => (
                <tr
                  key={inquiry.id}
                  onClick={() => setSelectedInquiryId(inquiry.id)}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(inquiry.status)}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(inquiry.status)}`} />
                      {getStatusLabel(inquiry.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-gray-900">{inquiry.subject}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {inquiry.user?.profile?.profileImageUrl ? (
                        <img
                          src={inquiry.user.profile.profileImageUrl}
                          alt=""
                          className="w-6 h-6 rounded-full"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs text-gray-600">
                          {inquiry.user?.email?.[0]?.toUpperCase() || 'U'}
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-900">
                          {inquiry.user?.email || 'Unknown'}
                        </span>
                        {inquiry.user?.profile?.nickname && (
                          <span className="text-xs text-gray-500">
                            {inquiry.user.profile.nickname}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {format(new Date(inquiry.createdAt), 'yy.MM.dd', { locale: ko })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Inquiry Detail Modal */}
      {selectedInquiryId && (
        <SupportInquiryDetailModal
          inquiryId={selectedInquiryId}
          onClose={() => setSelectedInquiryId(null)}
        />
      )}
    </div>
  );
}
