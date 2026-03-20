import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SupportInquiry, useCreateInquiry, useSupportInquiries } from '@/hooks/useSupport';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const inquirySchema = z.object({
  subject: z.string().min(1).max(200, '제목은 200자 이하여야 합니다'),
  message: z.string().min(10, '문의 내용은 최소 10자 이상이어야 합니다'),
});

type InquiryFormData = z.infer<typeof inquirySchema>;

interface SupportModalProps {
  inquiries: SupportInquiry[];
  onClose: () => void;
}

export function SupportModal({ inquiries: initialInquiries, onClose }: SupportModalProps) {
  const [showForm, setShowForm] = useState(false);
  const { data: inquiries = initialInquiries, refetch } = useSupportInquiries();
  const createInquiry = useCreateInquiry();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<InquiryFormData>({
    resolver: zodResolver(inquirySchema),
  });

  const onSubmit = async (data: InquiryFormData) => {
    try {
      await createInquiry.mutateAsync(data);
      await refetch();
      reset();
      setShowForm(false);
      alert('문의가 접수되었습니다.');
    } catch (error) {
      console.error('Failed to create inquiry:', error);
      alert('문의 접수에 실패했습니다.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-overlay-fade">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-modal-pop">
        <div className="sticky top-0 bg-white border-b border-brown-200 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-brown-900">고객지원</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {!showForm ? (
            <>
              <Button
                onClick={() => setShowForm(true)}
                className="w-full bg-[#665146] hover:bg-[#5A453A]"
              >
                <Plus className="w-4 h-4 mr-2" />
                새 문의 작성
              </Button>

              <div className="space-y-3">
                <h3 className="font-semibold text-brown-900">문의 내역</h3>
                {inquiries.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    문의 내역이 없습니다
                  </p>
                ) : (
                  inquiries.map((inquiry) => (
                    <div
                      key={inquiry.id}
                      className="bg-brown-50 rounded-lg p-3 border border-brown-200"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <p className="font-medium text-brown-900">{inquiry.subject}</p>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            inquiry.status === 'answered'
                              ? 'bg-green-100 text-green-700'
                              : inquiry.status === 'in_progress'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {inquiry.status === 'answered'
                            ? '답변 완료'
                            : inquiry.status === 'in_progress'
                            ? '처리 중'
                            : '접수'}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {inquiry.message}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(inquiry.createdAt), 'yyyy.MM.dd HH:mm', {
                          locale: ko,
                        })}
                      </p>
                      {inquiry.answer && (
                        <div className="mt-3 pt-3 border-t border-brown-200">
                          <p className="text-xs font-medium text-brown-700 mb-1">답변:</p>
                          <p className="text-sm text-brown-800">{inquiry.answer}</p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subject">제목</Label>
                <Input
                  id="subject"
                  {...register('subject')}
                  placeholder="문의 제목을 입력하세요"
                />
                {errors.subject && (
                  <p className="text-sm text-red-600">{errors.subject.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">문의 내용</Label>
                <textarea
                  id="message"
                  {...register('message')}
                  rows={8}
                  className="w-full px-3 py-2 border border-brown-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-brown-500"
                  placeholder="문의 내용을 입력하세요 (최소 10자)"
                />
                {errors.message && (
                  <p className="text-sm text-red-600">{errors.message.message}</p>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowForm(false);
                    reset();
                  }}
                >
                  취소
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-[#665146] hover:bg-[#5A453A]"
                  disabled={createInquiry.isPending}
                >
                  {createInquiry.isPending ? '접수 중...' : '접수하기'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
