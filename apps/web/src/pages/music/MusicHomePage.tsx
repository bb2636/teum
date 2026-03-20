import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Sprout, Sparkles, FileText, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDiaries } from '@/hooks/useDiaries';
import { useMusicJobs } from '@/hooks/useMusic';
import { useSubscriptions } from '@/hooks/usePayment';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const MONTHLY_LIMIT = 5;

export function MusicHomePage() {
  const navigate = useNavigate();
  const { data: jobsData, refetch: refetchJobs } = useMusicJobs();
  const { data: diariesAll = [] } = useDiaries();
  const { data: subscriptions = [], refetch: refetchSubscriptions } = useSubscriptions();

  useEffect(() => {
    refetchSubscriptions();
    refetchJobs();
  }, [refetchSubscriptions, refetchJobs]);


  const jobs = jobsData?.jobs ?? [];
  const monthlyUsed = jobsData?.monthlyUsed ?? 0;
  const hasSubscription = jobsData?.hasSubscription ?? false;
  const activeSubscription = subscriptions.find((s) => s.status === 'active');
  const subscriptionStartDate = activeSubscription?.startDate;
  const completedJobs = jobs.filter((j) => j.status === 'completed' || j.status === 'lyrics_only');

  const formatDuration = (seconds?: number) => {
    if (seconds == null) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
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
    <div className="min-h-screen bg-white pb-20">
      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* 제목 */}
        <h1 className="text-xl font-bold text-gray-900">음악 생성</h1>
        
        {/* 상단 Mureka 카드 */}
        <div className="bg-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs px-3 py-1 bg-gray-200 rounded-full font-bold text-gray-700">Mureka</span>
            <span className="text-xs text-gray-600">
              {subscriptionStartDate
                ? `결제일 ${format(new Date(subscriptionStartDate), 'M월 d일', { locale: ko })}`
                : '결제일'}
            </span>
          </div>
          <div className="mb-2">
            <p className="text-sm text-gray-600 mb-2">이번 달 생성 가능</p>
            <p className="text-3xl font-bold text-gray-900">{monthlyUsed}/{MONTHLY_LIMIT}</p>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            일기 총 {diariesAll.length}개
          </p>
          <Button
            onClick={handleOpenCreateModal}
            disabled={!hasSubscription || monthlyUsed >= MONTHLY_LIMIT}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-900 py-3 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <span>음악 생성</span>
            <Sparkles className="w-4 h-4" />
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
                  src="/music_logo.png"
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
            <div className="space-y-3">
              {completedJobs.map((job) => {
                const isLyricsOnly = job.status === 'lyrics_only';
                return (
                  <button
                    key={job.jobId}
                    type="button"
                    onClick={() => navigate(`/music/jobs/${job.jobId}`)}
                    className="w-full flex items-center gap-3 bg-white rounded-xl p-3 shadow-sm text-left hover:shadow-md transition-shadow"
                  >
                    <div className={`w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center ${
                      isLyricsOnly ? 'bg-amber-50' : 'bg-brown-100'
                    }`}>
                      {isLyricsOnly ? (
                        <FileText className="w-6 h-6 text-amber-600" />
                      ) : (
                        <Play className="w-6 h-6 text-brown-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-brown-900 truncate">
                        {job.title || '노래 제목이 들어갑니다.'}
                      </p>
                      {job.titleEn && (
                        <p className="text-xs text-muted-foreground truncate">
                          {job.titleEn}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        {isLyricsOnly ? (
                          <span className="text-xs text-amber-600 font-medium">가사만</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{formatDuration(job.durationSeconds)}</span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(job.createdAt), 'M월 d일', { locale: ko })}
                        </span>
                      </div>
                    </div>
                    {job.status === 'completed' && job.audioUrl && (
                      <div
                        role="button"
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
                        className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 flex-shrink-0"
                      >
                        <Download className="w-4 h-4 text-brown-600" />
                      </div>
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
