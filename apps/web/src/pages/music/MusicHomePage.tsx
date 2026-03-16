import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Music, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDiaries } from '@/hooks/useDiaries';
import { useGenerateMusic } from '@/hooks/useMusic';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export function MusicHomePage() {
  const navigate = useNavigate();
  const { data: diaries = [] } = useDiaries();
  const generateMusic = useGenerateMusic();
  const [selectedDiaryIds, setSelectedDiaryIds] = useState<string[]>([]);

  const toggleDiarySelection = (diaryId: string) => {
    setSelectedDiaryIds((prev) => {
      if (prev.includes(diaryId)) {
        return prev.filter((id) => id !== diaryId);
      }
      if (prev.length >= 7) {
        return prev; // Already selected 7
      }
      return [...prev, diaryId];
    });
  };

  const handleGenerate = async () => {
    if (selectedDiaryIds.length !== 7) {
      alert('정확히 7개의 일기를 선택해주세요');
      return;
    }

    try {
      const result = await generateMusic.mutateAsync(selectedDiaryIds);
      // Navigate to result page
      navigate(`/music/jobs/${result.jobId}`);
      setSelectedDiaryIds([]);
    } catch (error) {
      console.error('Failed to generate music:', error);
      alert('음악 생성에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const selectedCount = selectedDiaryIds.length;
  const canGenerate = selectedCount === 7;

  return (
    <div className="min-h-screen bg-beige-50 pb-20">
      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-brown-900">음악 생성</h1>
          <div className="text-sm text-muted-foreground">
            {selectedCount}/7
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <Music className="w-5 h-5 text-brown-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-brown-900 mb-1">
                7개의 일기로 음악 만들기
              </p>
              <p className="text-xs text-muted-foreground">
                음악을 만들고 싶은 일기 7개를 선택해주세요. 선택한 일기들의 감정과 내용을 분석하여 맞춤 음악을 생성합니다.
              </p>
            </div>
          </div>
        </div>

        {/* Diary List */}
        {diaries.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">작성된 일기가 없어요</p>
            <Button onClick={() => navigate('/diaries/write')}>
              일기 작성하기
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {diaries.map((diary) => {
                const isSelected = selectedDiaryIds.includes(diary.id);
                return (
                  <button
                    key={diary.id}
                    type="button"
                    onClick={() => toggleDiarySelection(diary.id)}
                    disabled={!isSelected && selectedCount >= 7}
                    className={`w-full text-left bg-white rounded-xl p-4 shadow-sm transition-all ${
                      isSelected
                        ? 'ring-2 ring-brown-600 bg-brown-50'
                        : selectedCount >= 7
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:shadow-md cursor-pointer'
                    }`}
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
                      </div>
                      <div className="flex-shrink-0">
                        {isSelected ? (
                          <CheckCircle2 className="w-5 h-5 text-brown-600" />
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-brown-300" />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Generate Button */}
            <div className="fixed bottom-20 left-0 right-0 px-4 pb-4">
              <Button
                onClick={handleGenerate}
                disabled={!canGenerate || generateMusic.isPending}
                className="w-full bg-brown-600 hover:bg-brown-700 text-white py-6 text-lg font-semibold"
              >
                {generateMusic.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    음악 생성 중...
                  </>
                ) : canGenerate ? (
                  '음악 생성하기'
                ) : (
                  `${selectedCount}/7개 선택됨`
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
