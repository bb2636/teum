import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useCreateInquiry } from '@/hooks/useSupport';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useHideTabBar } from '@/contexts/HideTabBarContext';
import { useT } from '@/hooks/useTranslation';

export function SupportInquiryPage() {
  const navigate = useNavigate();
  const { setHideTabBar } = useHideTabBar();
  const createInquiry = useCreateInquiry();
  const t = useT();
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const inquirySchema = z.object({
    subject: z.string().min(1, t('support.subjectRequired')).max(200, t('support.subjectMaxError')),
    message: z.string().min(10, t('support.contentMinError')).max(500, t('support.contentMaxError')),
  });

  type InquiryFormData = z.infer<typeof inquirySchema>;

  useEffect(() => {
    setHideTabBar(true);
    return () => {
      setHideTabBar(false);
    };
  }, [setHideTabBar]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
  } = useForm<InquiryFormData>({
    resolver: zodResolver(inquirySchema),
  });

  const messageValue = watch('message') || '';
  const messageLength = messageValue.length;

  const onSubmit = async (data: InquiryFormData) => {
    try {
      await createInquiry.mutateAsync(data);
      reset();
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Failed to create inquiry:', error);
      setErrorMessage(t('support.submitFailed'));
      setShowErrorModal(true);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    navigate('/my/support');
  };

  const handleErrorClose = () => {
    setShowErrorModal(false);
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="max-w-md mx-auto">
        <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between" style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 12px))' }}>
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[#4A2C1A]" />
          </button>
          <h1 className="text-lg font-semibold text-[#4A2C1A]">{t('support.writeInquiry')}</h1>
          <div className="w-10" />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-4 py-6 space-y-6">
          <div className="space-y-4">
            <label className="text-sm font-medium text-[#4A2C1A]">{t('support.contentLabel')}</label>

            <div className="space-y-2">
              <input
                type="text"
                {...register('subject')}
                placeholder={t('support.subjectPlaceholder')}
                className="w-full px-4 py-3 bg-gray-100 rounded-lg border-none focus:outline-none focus:ring-2 focus:ring-[#4A2C1A] text-[#4A2C1A] placeholder:text-gray-400"
              />
              {errors.subject && (
                <p className="text-sm text-red-600">{errors.subject.message}</p>
              )}
            </div>

            <div className="space-y-2 relative">
              <textarea
                {...register('message')}
                placeholder={t('support.contentPlaceholder')}
                rows={8}
                maxLength={500}
                className="w-full px-4 py-3 bg-gray-100 rounded-lg border-none focus:outline-none focus:ring-2 focus:ring-[#4A2C1A] resize-none text-[#4A2C1A] placeholder:text-gray-400"
              />
              <div className="absolute bottom-3 right-3">
                <span className="text-xs text-gray-400">
                  {messageLength}/500
                </span>
              </div>
              {errors.message && (
                <p className="text-sm text-red-600">{errors.message.message}</p>
              )}
            </div>
          </div>

          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 pb-safe-fixed">
            <button
              type="submit"
              disabled={createInquiry.isPending}
              className="w-full py-3 px-4 rounded-full bg-[#4A2C1A] hover:bg-[#3A2010] text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createInquiry.isPending ? t('support.registerSubmitting') : t('support.register')}
            </button>
          </div>
        </form>

        {showSuccessModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-overlay-fade">
            <div
              className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl animate-modal-pop"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center space-y-4">
                <p className="text-[#4A2C1A] mb-6">{t('support.registerSuccess')}</p>
                <button
                  onClick={handleSuccessClose}
                  className="w-full py-3 px-4 rounded-full bg-[#4A2C1A] hover:bg-[#3A2010] text-white font-medium transition-colors"
                >
                  {t('common.confirm')}
                </button>
              </div>
            </div>
          </div>
        )}

        {showErrorModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-overlay-fade">
            <div
              className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl animate-modal-pop"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center space-y-4">
                <p className="text-[#4A2C1A] mb-6">{errorMessage}</p>
                <button
                  onClick={handleErrorClose}
                  className="w-full py-3 px-4 rounded-full bg-[#4A2C1A] hover:bg-[#3A2010] text-white font-medium transition-colors"
                >
                  {t('common.confirm')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
