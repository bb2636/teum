import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDiary, useDeleteDiary, useCalendarDiaries } from '@/hooks/useDiaries';
import { StorageImage } from '@/components/StorageImage';
import { format } from 'date-fns';
import { getDateLocale } from '@/lib/dateFnsLocale';
import { useT } from '@/hooks/useTranslation';
import { useState, useRef, useMemo, useCallback } from 'react';
import { DiaryDeleteModal } from './DiaryDeleteModal';
import { Toast } from '@/components/Toast';
import DOMPurify from 'dompurify';

const SAFE_CSS_PROPERTY = /^(color|background-color|font-size|font-weight|font-style|text-align|text-decoration|line-height)$/i;

const sanitizeHTML = (html: string) => {
  DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
    if (data.attrName === 'style' && data.attrValue) {
      const safe = data.attrValue
        .split(';')
        .map((d) => d.trim())
        .filter((d) => {
          const [prop] = d.split(':');
          return prop && SAFE_CSS_PROPERTY.test(prop.trim());
        })
        .join('; ');
      data.attrValue = safe;
    }
  });

  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'u', 's', 'strike', 'del', 'em', 'strong', 'span', 'p', 'br', 'div', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'pre', 'img', 'font'],
    ALLOWED_ATTR: ['style', 'color', 'src', 'alt', 'class'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|data|blob):)|^\/api\/storage\//i,
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
  });

  DOMPurify.removeHook('uponSanitizeAttribute');
  const tmp = document.createElement('div');
  tmp.innerHTML = clean;
  tmp.querySelectorAll('img').forEach((img) => {
    img.setAttribute('alt', '');
  });
  tmp.querySelectorAll('font[color]').forEach((font) => {
    const color = font.getAttribute('color');
    const span = document.createElement('span');
    span.style.cssText = `color: ${color} !important`;
    span.innerHTML = font.innerHTML;
    font.replaceWith(span);
  });
  tmp.querySelectorAll('[style]').forEach((el) => {
    const style = (el as HTMLElement).style;
    if (style.color) {
      style.setProperty('color', style.color, 'important');
    }
  });
  return tmp.innerHTML;
};

export function DiaryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
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

  const fromCalendar = searchParams.get('from') === 'calendar';
  const dateParam = searchParams.get('date');
  const calYear = dateParam ? parseInt(dateParam.split('-')[0]) : new Date().getFullYear();
  const calMonth = dateParam ? parseInt(dateParam.split('-')[1]) : new Date().getMonth() + 1;
  const { data: calendarDiaries = [] } = useCalendarDiaries(calYear, calMonth);

  const sortedCalendarDiaries = useMemo(() => {
    if (!fromCalendar) return [];
    return [...calendarDiaries].sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      if (da !== db) return da - db;
      return a.id.localeCompare(b.id);
    });
  }, [calendarDiaries, fromCalendar]);

  const currentIndex = useMemo(() => {
    if (!fromCalendar || !id) return -1;
    return sortedCalendarDiaries.findIndex((d) => d.id === id);
  }, [sortedCalendarDiaries, id, fromCalendar]);

  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const navigateToDiary = useCallback((index: number) => {
    if (index < 0 || index >= sortedCalendarDiaries.length) return;
    const targetDiary = sortedCalendarDiaries[index];
    const targetDate = format(new Date(targetDiary.date), 'yyyy-MM-dd');
    navigate(`/diaries/${targetDiary.id}?from=calendar&date=${targetDate}`, { replace: true });
  }, [sortedCalendarDiaries, navigate]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!fromCalendar || isTransitioning) return;
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (swipeStartX.current === null || swipeStartY.current === null || isTransitioning || !fromCalendar) return;
    const diffX = e.touches[0].clientX - swipeStartX.current;
    const diffY = e.touches[0].clientY - swipeStartY.current;
    if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffX) < 10) return;
    if (Math.abs(diffX) > 10) {
      e.preventDefault();
    }
    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex < sortedCalendarDiaries.length - 1;
    if ((diffX > 0 && !hasPrev) || (diffX < 0 && !hasNext)) {
      setSwipeOffset(diffX * 0.3);
    } else {
      setSwipeOffset(diffX);
    }
  };

  const handleTouchEnd = () => {
    if (swipeStartX.current === null || isTransitioning || !fromCalendar) {
      swipeStartX.current = null;
      swipeStartY.current = null;
      return;
    }
    const threshold = 60;
    if (Math.abs(swipeOffset) > threshold) {
      const direction = swipeOffset > 0 ? -1 : 1;
      const targetIndex = currentIndex + direction;
      if (targetIndex >= 0 && targetIndex < sortedCalendarDiaries.length) {
        setIsTransitioning(true);
        const targetOffset = swipeOffset > 0 ? window.innerWidth : -window.innerWidth;
        setSwipeOffset(targetOffset);
        setTimeout(() => {
          navigateToDiary(targetIndex);
          setSwipeOffset(0);
          setIsTransitioning(false);
        }, 200);
      } else {
        setSwipeOffset(0);
      }
    } else {
      setSwipeOffset(0);
    }
    swipeStartX.current = null;
    swipeStartY.current = null;
  };

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

  const backPath = fromCalendar ? '/calendar' : '/home';

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
    <div
      className="min-h-screen bg-beige-50"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="max-w-md mx-auto"
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isTransitioning ? 'transform 0.2s ease-out' : 'none',
        }}
      >
        <div className="sticky top-0 z-30 bg-beige-50 px-4 py-3 flex items-center justify-between border-b border-gray-200" style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 12px))' }}>
          <Link to={backPath}>
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

        <div className="px-4 py-6 diary-detail-content">
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
              <div
                className="diary-content text-[#4A2C1A] leading-relaxed whitespace-pre-wrap diary-user-formatted"
                dangerouslySetInnerHTML={{ __html: sanitizeHTML(diary.content) }}
              />
            </div>
          )}

          {diary.type === 'question_based' && diary.answers && diary.answers.length > 0 && (
            <div className="space-y-4 pt-4 border-t">
              {diary.answers.map((answer) => (
                <div key={answer.id} className="space-y-2">
                  <h3 className="font-semibold text-brown-900">
                    {answer.question?.question || '질문'}
                  </h3>
                  <div
                    className="diary-content text-brown-700 leading-relaxed whitespace-pre-wrap diary-user-formatted"
                    dangerouslySetInnerHTML={{ __html: sanitizeHTML(answer.answer || '') }}
                  />
                </div>
              ))}
            </div>
          )}
          </div>

          {(diary.aiMessage || diary.aiFeedback?.outputText) && (
            <div className="diary-ai-card bg-white rounded-xl p-6 shadow-sm border-l-4 border-amber-300 mt-4">
              <p className="text-sm font-semibold text-amber-800 mb-2">{t('diary.encouragementMessage')}</p>
              <p className="text-base text-brown-800 leading-relaxed">
                {diary.aiMessage || diary.aiFeedback?.outputText}
              </p>
            </div>
          )}

          {diary.aiSummary && (
            <div className="diary-ai-card bg-white rounded-xl p-6 shadow-sm border-l-4 border-blue-300 mt-4">
              <p className="text-sm font-semibold text-blue-800 mb-2">{t('diary.aiSummary')}</p>
              <p className="text-base text-brown-800 leading-relaxed">
                {diary.aiSummary}
              </p>
            </div>
          )}

          <button
            onClick={() => setShowComingSoon(true)}
            className="diary-ai-chat-btn w-full mt-4 mb-8 py-3.5 px-4 rounded-full bg-[#F5F0EB] text-[#4A2C1A] font-medium transition-colors hover:bg-[#EDE5DC] flex items-center justify-center gap-2"
            style={{ marginBottom: 'max(2rem, calc(env(safe-area-inset-bottom, 0px) + 5rem))' }}
          >
            <MessageCircle className="w-4 h-4" />
            {t('diary.chatWithAi')}
          </button>
        </div>

        {fromCalendar && sortedCalendarDiaries.length > 1 && (
          <div className="flex justify-center gap-1 pb-6">
            {sortedCalendarDiaries.map((d, i) => (
              <div
                key={d.id}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === currentIndex ? 'bg-[#4A2C1A]' : 'bg-gray-300'
                }`}
              />
            )).slice(
              Math.max(0, currentIndex - 4),
              Math.min(sortedCalendarDiaries.length, currentIndex + 5)
            )}
          </div>
        )}
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
              <MessageCircle className="w-6 h-6 text-[#4A2C1A]" />
            </div>
            <p className="text-base text-[#4A2C1A] whitespace-pre-line leading-relaxed">
              {t('diary.chatWithAiComingSoon')}
            </p>
            <button
              onClick={() => setShowComingSoon(false)}
              className="mt-5 w-full py-3 rounded-full bg-[#4A2C1A] text-white font-medium hover:bg-[#3A2010] transition-colors"
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
