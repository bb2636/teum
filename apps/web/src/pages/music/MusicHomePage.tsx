import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Sprout } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDiaries } from '@/hooks/useDiaries';
import { useMusicJobs } from '@/hooks/useMusic';
import { useSubscriptions } from '@/hooks/usePayment';
import { StorageImage } from '@/components/StorageImage';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const MONTHLY_LIMIT = 5;

export function MusicHomePage() {
  const navigate = useNavigate();
  const { data: jobsData } = useMusicJobs();
  const { data: diariesAll = [] } = useDiaries();
  const { data: subscriptions = [], refetch: refetchSubscriptions } = useSubscriptions();

  // 페이지 마운트 시 구독 정보 갱신 (결제 성공 후 바로 반영되도록)
  useEffect(() => {
    refetchSubscriptions();
  }, [refetchSubscriptions]);


  const jobs = jobsData?.jobs ?? [];
  const monthlyUsed = jobsData?.monthlyUsed ?? 0;
  const hasSubscription = jobsData?.hasSubscription ?? false;
  const activeSubscription = subscriptions.find((s) => s.status === 'active');
  const subscriptionStartDate = activeSubscription?.startDate;
  const completedJobs = jobs.filter((j) => j.status === 'completed');

  const formatDuration = (seconds?: number) => {
    if (seconds == null) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // 일기 첫 줄 추출 함수
  const getFirstLine = (diary: { title?: string; content?: string; type?: string; answers?: Array<{ answer?: string; question?: { question?: string } }> }) => {
    if (diary.title?.trim()) return diary.title.trim();
    if (diary.type === 'question_based' && diary.answers?.length) {
      // 질문기록일 때는 먼저 첫 번째 질문 제목을 확인
      const firstQuestion = diary.answers[0].question?.question?.trim();
      if (firstQuestion) return firstQuestion;
      // 질문 제목이 없으면 답변 내용 확인
      const first = diary.answers[0].answer?.trim();
      if (first) {
        // HTML 태그 제거
        const tmp = document.createElement('div');
        tmp.innerHTML = first;
        const text = tmp.textContent || tmp.innerText || '';
        return text.split('\n')[0].trim() || text;
      }
      return '';
    }
    if (diary.content?.trim()) {
      // HTML 태그 제거
      const tmp = document.createElement('div');
      tmp.innerHTML = diary.content;
      const text = tmp.textContent || tmp.innerText || '';
      return text.trim().split('\n')[0].trim();
    }
    return '';
  };

  const handleOpenCreateModal = () => {
    if (!hasSubscription) {
      navigate('/payment');
      return;
    }
    if (monthlyUsed >= MONTHLY_LIMIT) {
      return;
    }
    navigate('/music/create');
  };


  return (
    <div className="min-h-screen bg-beige-50 pb-20">
      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* 상단 Mureka 카드 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-brown-900">Mureka</span>
            <span className="text-xs text-muted-foreground">
              {subscriptionStartDate
                ? `구독일 ${format(new Date(subscriptionStartDate), 'M월 d일', { locale: ko })}`
                : '구독일'}
            </span>
          </div>
          <p className="text-sm text-brown-800 mb-1">
            이번 달 생성 가능 <span className="font-semibold">{monthlyUsed}/{MONTHLY_LIMIT}</span>
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            일기 총 {diariesAll.length}개
          </p>
          <Button
            onClick={handleOpenCreateModal}
            disabled={!hasSubscription || monthlyUsed >= MONTHLY_LIMIT}
            className="w-full bg-brown-600 hover:bg-brown-700 text-white py-3 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            음악 생성 +
          </Button>
          {!hasSubscription && (
            <p className="text-xs text-amber-700 mt-2 text-center">
              음악 생성을 이용하려면 구독이 필요합니다.
            </p>
          )}
        </div>

        {/* 내 음악 */}
        <section>
          <h2 className="text-lg font-semibold text-brown-900 mb-3">내 음악</h2>
          {completedJobs.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
              <div className="flex justify-center mb-4">
                <img
                  src="/music-empty.png"
                  alt=""
                  className="w-24 h-24 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <div className="hidden w-24 h-24 flex items-center justify-center text-brown-500">
                  <Sprout className="w-16 h-16" />
                </div>
              </div>
              <p className="font-medium text-brown-900 mb-2">아직 생성된 음악이 없어요.</p>
              <p className="text-sm text-muted-foreground">
                일기의 감정이 그대로 담긴 단 하나의 선율입니다. 기록하는 순간, 새로운 음악이 태어납니다.
              </p>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
              {completedJobs.map((job) => {
                const sourceDiaries = job.sourceDiaryIds
                  ? job.sourceDiaryIds
                      .map((id) => diariesAll.find((d) => d.id === id))
                      .filter(Boolean)
                      .slice(0, 3) // 최대 3개만 표시
                  : [];
                
                return (
                  <button
                    key={job.jobId}
                    type="button"
                    onClick={() => navigate(`/music/jobs/${job.jobId}`)}
                    className="relative flex-shrink-0 w-72 bg-white rounded-xl p-4 shadow-sm text-left hover:shadow-md transition-shadow"
                  >
                    {/* 노래 제목 */}
                    <p className="font-bold text-brown-900 text-lg mb-0.5 line-clamp-1">
                      {job.title || '노래 제목이 들어갑니다.'}
                    </p>
                    {job.titleEn && (
                      <p className="text-xs text-muted-foreground truncate mb-2">
                        {job.titleEn}
                      </p>
                    )}
                    
                    {/* 재생 시간 */}
                    <p className="text-xs text-muted-foreground mb-3 text-right">
                      {formatDuration(job.durationSeconds)}
                    </p>
                    
                    {/* 구분선 */}
                    <div className="border-t border-brown-100 mb-3" />
                    
                    {/* 일기 목록 */}
                    <div className="space-y-2">
                      {sourceDiaries.map((diary, idx) => {
                        if (!diary) return null;
                        const firstImage = diary.images && diary.images.length > 0 ? diary.images[0].imageUrl : null;
                        return (
                          <div key={diary.id || idx} className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded bg-brown-100 flex-shrink-0 overflow-hidden">
                              {firstImage ? (
                                <StorageImage
                                  url={firstImage}
                                  alt="Diary"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-brown-400">
                                  <span className="text-xs">📝</span>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-brown-900 truncate">
                                {getFirstLine(diary) || '일기 제목이 들어갑니다.'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(diary.date), 'M월 d일 (EEE)', { locale: ko })}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* 다운로드 버튼 */}
                    {job.audioUrl && (
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const response = await fetch(job.audioUrl!);
                            const blob = await response.blob();
                            const blobUrl = window.URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = blobUrl;
                            const filename = `${(job.title || 'music').replace(/[^a-zA-Z0-9가-힣]/g, '_')}.mp3`;
                            link.download = filename;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            window.URL.revokeObjectURL(blobUrl);
                          } catch (error) {
                            console.error('Download failed:', error);
                            window.open(job.audioUrl, '_blank');
                          }
                        }}
                        className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-white border border-brown-200 flex items-center justify-center hover:bg-brown-50 shadow-sm"
                      >
                        <Download className="w-4 h-4 text-brown-600" />
                      </button>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

    </div>
  );
}
