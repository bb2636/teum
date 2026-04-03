import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { t } from '@/lib/i18n';
import { getDateLocale } from '@/lib/dateFnsLocale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SupportInquiry, useCreateInquiry, useSupportInquiries } from '@/hooks/useSupport';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

function getInquirySchema() {
  return z.object({
    subject: z.string().min(1).max(200, t('support.subjectMaxError')),
    message: z.string().min(10, t('support.contentMinError')),
  });
}

type InquiryFormData = z.infer<ReturnType<typeof getInquirySchema>>;

interface SupportModalProps {
  inquiries: SupportInquiry[];
  onClose: () => void;
}

export function SupportModal({ inquiries: initialInquiries, onClose }: SupportModalProps) {
  const [showForm, setShowForm] = useState(false);
  const { data: inquiries = initialInquiries, refetch } = useSupportInquiries();
  const createInquiry = useCreateInquiry();
  const locale = getDateLocale();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<InquiryFormData>({
    resolver: zodResolver(getInquirySchema()),
  });

  const onSubmit = async (data: InquiryFormData) => {
    try {
      await createInquiry.mutateAsync(data);
      await refetch();
      reset();
      setShowForm(false);
      alert(t('support.submitted'));
    } catch (error) {
      console.error('Failed to create inquiry:', error);
      alert(t('support.submitFailed'));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-overlay-fade">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-modal-pop">
        <div className="sticky top-0 bg-white border-b border-brown-200 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-brown-900">{t('support.title')}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {!showForm ? (
            <>
              <Button
                onClick={() => setShowForm(true)}
                className="w-full bg-[#4A2C1A] hover:bg-[#3A2010]"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('support.newInquiryWrite')}
              </Button>

              <div className="space-y-3">
                <h3 className="font-semibold text-brown-900">{t('support.inquiryHistory')}</h3>
                {inquiries.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {t('support.noInquiries')}
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
                            ? t('support.answered')
                            : inquiry.status === 'in_progress'
                            ? t('support.inProgress')
                            : t('support.waiting')}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {inquiry.message}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(inquiry.createdAt), 'yyyy.MM.dd HH:mm', {
                          locale,
                        })}
                      </p>
                      {inquiry.answer && (
                        <div className="mt-3 pt-3 border-t border-brown-200">
                          <p className="text-xs font-medium text-brown-700 mb-1">{t('support.answer')}:</p>
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
                <Label htmlFor="subject">{t('support.subjectLabel')}</Label>
                <Input
                  id="subject"
                  {...register('subject')}
                  placeholder={t('support.subjectPlaceholder')}
                />
                {errors.subject && (
                  <p className="text-sm text-red-600">{errors.subject.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">{t('support.contentLabel')}</Label>
                <textarea
                  id="message"
                  {...register('message')}
                  rows={8}
                  className="w-full px-3 py-2 border border-brown-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-brown-500"
                  placeholder={t('support.contentPlaceholder')}
                />
                {errors.message && (
                  <p className="text-sm text-red-600">{errors.message.message}</p>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-0 rounded-full hover:bg-gray-100"
                  onClick={() => {
                    setShowForm(false);
                    reset();
                  }}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-[#4A2C1A] hover:bg-[#3A2010]"
                  disabled={createInquiry.isPending}
                >
                  {createInquiry.isPending ? t('support.submitting') : t('support.submitInquiry')}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
