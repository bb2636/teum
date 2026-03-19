import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDiary, useDeleteDiary } from '@/hooks/useDiaries';
import { StorageImage } from '@/components/StorageImage';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useState } from 'react';
import { DiaryDeleteModal } from './DiaryDeleteModal';

export function DiaryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: diary, isLoading } = useDiary(id || '');
  const deleteDiary = useDeleteDiary();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!id) return;

    setIsDeleting(true);
    deleteDiary.mutate(id, {
      onSuccess: () => {
        navigate('/home');
      },
      onError: () => {
        setIsDeleting(false);
        setShowDeleteModal(false);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-beige-50 flex items-center justify-center">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  if (!diary) {
    return (
      <div className="min-h-screen bg-beige-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">일기를 찾을 수 없습니다</p>
          <Link to="/home">
            <Button>홈으로 돌아가기</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-beige-50 pb-20">
      <div className="max-w-md mx-auto">
        {/* Header - Fixed */}
        <div className="sticky top-0 z-30 bg-beige-50 px-4 py-3 flex items-center justify-between border-b border-gray-200">
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

        {/* Diary Content */}
        <div className="px-4 py-6">
          <div className="bg-white rounded-xl p-6 shadow-sm space-y-4">
          {/* Date and Type */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {format(new Date(diary.date), 'yyyy년 M월 d일', { locale: ko })}
            </span>
            {diary.type === 'question_based' && (
              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                질문기록
              </span>
            )}
          </div>

          {/* Title */}
          {diary.title && (
            <h1 className="text-2xl font-bold text-brown-900">{diary.title}</h1>
          )}

          {/* Images */}
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

          {/* Content */}
          {diary.content && (
            <div className="prose prose-sm max-w-none">
              <div className="text-brown-800 leading-relaxed whitespace-pre-wrap">
                {(() => {
                  // HTML 태그 제거 (기존 데이터에 <br> 태그가 있을 수 있음)
                  const tmp = document.createElement('div');
                  tmp.innerHTML = diary.content;
                  let text = tmp.textContent || tmp.innerText || '';
                  // <br> 태그를 줄바꿈으로 변환
                  text = text.replace(/<br\s*\/?>/gi, '\n');
                  // HTML 엔티티 디코딩
                  text = text.replace(/&nbsp;/g, ' ');
                  return text;
                })()}
              </div>
            </div>
          )}

          {/* Question-based answers */}
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

        {/* AI 응원 메시지 - 맨 밑 별도 섹션 */}
        {(diary.aiMessage || diary.aiFeedback?.outputText) && (
          <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-amber-300">
            <p className="text-sm font-semibold text-amber-800 mb-2">응원 메시지</p>
            <p className="text-base text-brown-800 leading-relaxed">
              {diary.aiMessage || diary.aiFeedback?.outputText}
            </p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <DiaryDeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        isLoading={isDeleting}
      />
    </div>
  );
}
