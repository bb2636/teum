import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDiary, useDeleteDiary } from '@/hooks/useDiaries';
import { StorageImage } from '@/components/StorageImage';
import { format } from 'date-fns';
import { getDateLocale } from '@/lib/dateFnsLocale';
import { useT } from '@/hooks/useTranslation';
import { useState } from 'react';
import { DiaryDeleteModal } from './DiaryDeleteModal';
import { Toast } from '@/components/Toast';

export function DiaryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = useT();
  const locale = getDateLocale();
  const { data: diary, isLoading } = useDiary(id || '');
  const deleteDiary = useDeleteDiary();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!id) return;

    setIsDeleting(true);
    setShowDeleteModal(false);
    deleteDiary.mutate(id, {
      onSuccess: () => {
        setToastMessage(t('diary.deleted'));
        setShowToast(true);
        setTimeout(() => {
          navigate('/home', { replace: true });
        }, 800);
      },
      onError: () => {
        setIsDeleting(false);
        setToastMessage(t('diary.deleteFailed'));
        setShowToast(true);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-beige-50 flex items-center justify-center">
        <div className="text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  if (!diary) {
    return (
      <div className="min-h-screen bg-beige-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">{t('diary.notFound')}</p>
          <Link to="/home">
            <Button>{t('common.goHome')}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-beige-50">
      <div className="max-w-md mx-auto">
        <div className="sticky top-0 z-30 bg-beige-50 px-4 py-3 flex items-center justify-between border-b border-gray-200" style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 12px))' }}>
          <Link to="/home">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex gap-2">
            <Link to={`/diaries/${id}/edit`}>
              <Button variant="ghost" size="icon">
                <Edit className="w-5 h-5" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDeleteClick}
              disabled={isDeleting}
            >
              <Trash2 className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="px-4 py-6">
          <div className="bg-white rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {format(new Date(diary.date), 'yyyy.MM.dd', { locale })}
            </span>
            {diary.type === 'question_based' && (
              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                {t('diary.questionRecord')}
              </span>
            )}
          </div>

          {diary.title && (
            <h1 className="text-2xl font-bold text-[#4A2C1A]">{diary.title}</h1>
          )}

          {diary.images && diary.images.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {diary.images.map((img) => (
                <StorageImage
                  key={img.id}
                  url={img.imageUrl}
                  className="w-full h-48 rounded-lg object-cover"
                />
              ))}
            </div>
          )}

          {diary.content && (
            <div className="prose prose-sm max-w-none">
              <div className="text-brown-800 leading-relaxed whitespace-pre-wrap">
                {(() => {
                  const tmp = document.createElement('div');
                  tmp.innerHTML = diary.content;
                  let text = tmp.textContent || tmp.innerText || '';
                  text = text.replace(/<br\s*\/?>/gi, '\n');
                  text = text.replace(/&nbsp;/g, ' ');
                  return text;
                })()}
              </div>
            </div>
          )}

          {diary.type === 'question_based' && diary.answers && diary.answers.length > 0 && (
            <div className="space-y-4 pt-4 border-t">
              {diary.answers.map((answer) => (
                <div key={answer.id} className="space-y-2">
                  <h3 className="font-semibold text-brown-900">
                    {answer.question?.question || '질문'}
                  </h3>
                  <p className="text-brown-700">{answer.answer}</p>
                </div>
              ))}
            </div>
          )}
          </div>

          {(diary.aiMessage || diary.aiFeedback?.outputText) && (
            <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-amber-300 mt-4">
              <p className="text-sm font-semibold text-amber-800 mb-2">{t('diary.encouragementMessage')}</p>
              <p className="text-base text-brown-800 leading-relaxed">
                {diary.aiMessage || diary.aiFeedback?.outputText}
              </p>
            </div>
          )}

          {diary.aiSummary && (
            <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-blue-300 mt-4">
              <p className="text-sm font-semibold text-blue-800 mb-2">{t('diary.aiSummary')}</p>
              <p className="text-base text-brown-800 leading-relaxed">
                {diary.aiSummary}
              </p>
            </div>
          )}

          <button
            onClick={() => setShowComingSoon(true)}
            className="w-full mt-4 py-3.5 px-4 rounded-full bg-[#F5F0EB] text-[#4A2C1A] font-medium transition-colors hover:bg-[#EDE5DC] flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            {t('diary.chatWithAi')}
          </button>
        </div>
      </div>

      <DiaryDeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        isLoading={isDeleting}
      />

      {showComingSoon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowComingSoon(false)}>
          <div className="bg-white rounded-2xl p-6 mx-6 max-w-sm w-full text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-[#F5F0EB] flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-6 h-6 text-[#665146]" />
            </div>
            <p className="text-base text-[#4A2C1A] whitespace-pre-line leading-relaxed">
              {t('diary.chatWithAiComingSoon')}
            </p>
            <button
              onClick={() => setShowComingSoon(false)}
              className="mt-5 w-full py-3 rounded-full bg-[#665146] text-white font-medium hover:bg-[#5A453A] transition-colors"
            >
              {t('common.confirm')}
            </button>
          </div>
        </div>
      )}

      <Toast
        message={toastMessage}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
      />
    </div>
  );
}
