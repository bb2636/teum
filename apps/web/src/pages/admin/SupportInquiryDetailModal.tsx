import { useState, useEffect } from 'react';
import { useAdminSupportInquiry, useUpdateInquiryAnswer } from '@/hooks/useSupport';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface SupportInquiryDetailModalProps {
  inquiryId: string;
  onClose: () => void;
}

export function SupportInquiryDetailModal({
  inquiryId,
  onClose,
}: SupportInquiryDetailModalProps) {
  const { data: inquiry, isLoading } = useAdminSupportInquiry(inquiryId);
  const updateAnswer = useUpdateInquiryAnswer();
  const [answer, setAnswer] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    if (inquiry?.answer) {
      setAnswer(inquiry.answer);
    } else {
      setAnswer('');
    }
  }, [inquiry]);

  const handleClose = () => {
    if (answer.trim() && answer !== inquiry?.answer) {
      if (!confirm('입력한 답변이 취소됩니다. 계속하시겠습니까?')) {
        return;
      }
    }
    setAnswer('');
    onClose();
  };

  const handleSendAnswer = () => {
    if (!answer.trim()) return;
    setShowConfirmModal(true);
  };

  const handleConfirmSend = async () => {
    if (!answer.trim()) return;
    
    try {
      await updateAnswer.mutateAsync({
        id: inquiryId,
        answer: answer.trim(),
      });
      setShowConfirmModal(false);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Failed to send answer:', error);
      alert('답변 전송에 실패했습니다.');
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    onClose();
  };

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
    return (
      <>
        <div className="fixed inset-0 bg-black/50 z-40" onClick={handleClose} />
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl mx-4 p-6 pointer-events-auto">
            <div className="text-center text-gray-500">로딩 중...</div>
          </div>
        </div>
      </>
    );
  }

  if (!inquiry) {
    return null;
  }

  const user = inquiry.user;
  const userEmail = user?.email || 'Unknown';
  const userNickname = user?.profile?.nickname;
  const userProfileImage = user?.profile?.profileImageUrl;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={handleClose}
      />
      
      {/* Main Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div
          className="bg-white rounded-lg shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-[#4A2C1A]">1:1 문의 상세</h2>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(inquiry.status)}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(inquiry.status)}`} />
                {getStatusLabel(inquiry.status)}
              </span>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* User Info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {userProfileImage ? (
                  <img
                    src={userProfileImage}
                    alt=""
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-sm text-gray-600">
                    {userEmail[0]?.toUpperCase() || 'U'}
                  </div>
                )}
                <div>
                  <div className="text-sm font-medium text-gray-900">{userEmail}</div>
                  {userNickname && (
                    <div className="text-xs text-gray-500">{userNickname}</div>
                  )}
                </div>
              </div>
              <div className="text-sm text-gray-600">
                {format(new Date(inquiry.createdAt), 'M월 d일 (E)', { locale: ko })}
              </div>
            </div>

            {/* Inquiry Subject */}
            <div>
              <h3 className="text-base font-semibold text-[#4A2C1A] mb-2">
                {inquiry.subject}
              </h3>
            </div>

            {/* Inquiry Message */}
            <div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {inquiry.message}
              </p>
            </div>

            {/* Admin Answer Section */}
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-base font-semibold text-[#4A2C1A]">관리자 답변</h4>
                {inquiry.answeredAt && (
                  <div className="text-sm text-gray-600">
                    {format(new Date(inquiry.answeredAt), 'M월 d일 (E)', { locale: ko })}
                  </div>
                )}
              </div>
              
              {inquiry.answer ? (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {inquiry.answer}
                  </p>
                </div>
              ) : (
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="사용자에게 보낼 답변을 입력하세요"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#4A2C1A] focus:border-transparent"
                  rows={6}
                />
              )}
            </div>
          </div>

          {/* Footer */}
          {!inquiry.answer && (
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
              <Button
                onClick={handleClose}
                variant="outline"
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                취소
              </Button>
              <Button
                onClick={handleSendAnswer}
                disabled={!answer.trim() || updateAnswer.isPending}
                className={`${
                  answer.trim() && !updateAnswer.isPending
                    ? 'bg-[#4A2C1A] text-white hover:bg-[#3A2215]'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                답변 보내기
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Confirm Modal */}
      {showConfirmModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowConfirmModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-[60] pointer-events-none">
            <div
              className="bg-[#F5F5F0] rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8 pointer-events-auto flex flex-col items-center text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-base font-medium text-gray-900 mb-8">
                답변을 보내시겠습니까?
              </p>
              <div className="flex items-center justify-center gap-4">
                <Button
                  onClick={() => setShowConfirmModal(false)}
                  variant="ghost"
                  className="text-gray-900 hover:bg-transparent hover:text-gray-700"
                >
                  취소
                </Button>
                <Button
                  onClick={handleConfirmSend}
                  disabled={updateAnswer.isPending}
                  className="bg-[#4A2C1A] text-white hover:bg-[#3A2215] rounded-xl px-6"
                >
                  {updateAnswer.isPending ? '전송 중...' : '수정'}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={handleSuccessClose} />
          <div className="fixed inset-0 flex items-center justify-center z-[60] pointer-events-none">
            <div
              className="bg-[#F5F5F0] rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8 pointer-events-auto flex flex-col items-center text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-base font-medium text-gray-900 mb-8">
                답변이 등록되었습니다
              </p>
              <Button
                onClick={handleSuccessClose}
                variant="ghost"
                className="text-gray-900 hover:bg-transparent hover:text-gray-700"
              >
                완료
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
