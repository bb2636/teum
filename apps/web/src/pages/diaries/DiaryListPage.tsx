import { useSearchParams, Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDiaries } from '@/hooks/useDiaries';
import { getStorageImageSrc } from '@/lib/api';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export function DiaryListPage() {
  const [searchParams] = useSearchParams();
  const date = searchParams.get('date');
  const folderId = searchParams.get('folderId') || undefined;

  const { data: diaries = [], isLoading } = useDiaries(folderId);

  // Filter by date if provided
  const filteredDiaries = date
    ? diaries.filter((diary) => {
        const diaryDate = format(new Date(diary.date), 'yyyy-MM-dd');
        return diaryDate === date;
      })
    : diaries;

  return (
    <div className="min-h-screen bg-beige-50 pb-20">
      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-brown-900">
            {date ? format(new Date(date), 'yyyy년 M월 d일', { locale: ko }) : '일기 목록'}
          </h1>
          <Link to="/diaries/new">
            <Button
              size="icon"
              className="w-10 h-10 rounded-full bg-brown-600 hover:bg-brown-700 text-white"
            >
              <Plus className="w-5 h-5" />
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">로딩 중...</div>
        ) : filteredDiaries.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>작성된 일기가 없어요</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDiaries.map((diary) => (
              <Link
                key={diary.id}
                to={`/diaries/${diary.id}`}
                className="block bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(diary.date), 'yyyy.MM.dd', { locale: ko })}
                      </span>
                      {diary.type === 'question_based' && (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                          질문
                        </span>
                      )}
                    </div>
                    {diary.title && (
                      <h3 className="font-semibold text-brown-900 mb-1 truncate">
                        {diary.title}
                      </h3>
                    )}
                    {diary.content && (
                      <p className="text-sm text-brown-700 line-clamp-2">
                        {diary.content}
                      </p>
                    )}
                    {diary.images && diary.images.length > 0 && (
                      <div className="flex gap-2 mt-2">
                        {diary.images.slice(0, 3).map((img) => (
                          <img
                            key={img.id}
                            src={getStorageImageSrc(img.imageUrl)}
                            alt=""
                            className="w-16 h-16 rounded object-cover"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
