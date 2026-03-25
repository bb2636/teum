import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Sprout, Sparkles, ChevronRight, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDiaries } from '@/hooks/useDiaries';
import { useMusicJobs, MusicJobListItem } from '@/hooks/useMusic';
import { useSubscriptions, getEffectiveSubscription } from '@/hooks/usePayment';
import { StorageImage } from '@/components/StorageImage';
import { ProfileButton } from '@/components/ProfileButton';
import { format } from 'date-fns';
import { getDateLocale } from '@/lib/dateFnsLocale';
import { useT } from '@/hooks/useTranslation';
import type { Diary } from '@/hooks/useDiaries';

const MONTHLY_LIMIT = 5;

interface MusicCardCarouselProps {
  jobs: MusicJobListItem[];
  diaryMap: Map<string, Diary>;
  onCardClick: (jobId: string) => void;
  onDownload: (e: React.MouseEvent, job: MusicJobListItem) => void;
  formatDuration: (seconds?: number) => string;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const CARD_GRADIENTS = [
  'linear-gradient(145deg, #8B7355 0%, #6B5B45 50%, #4A3C2A 100%)',
  'linear-gradient(145deg, #5B7B6A 0%, #3D5E4D 50%, #2A4235 100%)',
  'linear-gradient(145deg, #7B6B8A 0%, #5D4D6B 50%, #3E334D 100%)',
  'linear-gradient(145deg, #7A6A5A 0%, #5A4A3A 50%, #3A2A1A 100%)',
  'linear-gradient(145deg, #6A7B8B 0%, #4D5E6B 50%, #33424D 100%)',
  'linear-gradient(145deg, #8B6B6B 0%, #6B4D4D 50%, #4D3333 100%)',
  'linear-gradient(145deg, #6B7B5B 0%, #4D5E3D 50%, #33422A 100%)',
  'linear-gradient(145deg, #7B7565 0%, #5E5845 50%, #423C2A 100%)',
];

const CARD_DOT_COLORS = [
  '#8B7355',
  '#5B7B6A',
  '#7B6B8A',
  '#7A6A5A',
  '#6A7B8B',
  '#8B6B6B',
  '#6B7B5B',
  '#7B7565',
];

function getCardColorIndex(index: number): number {
  return index % CARD_GRADIENTS.length;
}

function getCardGradient(index: number): string {
  return CARD_GRADIENTS[getCardColorIndex(index)];
}

function getCardDotColor(index: number): string {
  return CARD_DOT_COLORS[getCardColorIndex(index)];
}

function MusicCardCarousel({ jobs, diaryMap, onCardClick, onDownload, formatDuration, t }: MusicCardCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const locale = getDateLocale();

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.firstElementChild?.getBoundingClientRect().width ?? 280;
    const gap = 16;
    const idx = Math.round(el.scrollLeft / (cardWidth + gap));
    setActiveIndex(Math.min(idx, jobs.length - 1));
  }, [jobs.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const scrollToIndex = (idx: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.firstElementChild?.getBoundingClientRect().width ?? 280;
    const gap = 16;
    el.scrollTo({ left: idx * (cardWidth + gap), behavior: 'smooth' });
  };

  return (
    <div>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto px-4 pb-3 snap-x snap-mandatory scrollbar-hide"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {jobs.map((job, index) => {
          const isLyricsOnly = job.status === 'lyrics_only';
          const sourceDiaries = (job.sourceDiaryIds || [])
            .map((id) => diaryMap.get(id))
            .filter(Boolean) as Diary[];

          return (
            <div
              key={job.jobId}
              className="flex-shrink-0 w-[calc(100vw-48px)] max-w-[340px] rounded-2xl overflow-hidden snap-center cursor-pointer animate-slide-up"
              style={{ background: getCardGradient(index), animationDelay: `${index * 100}ms` }}
              onClick={() => onCardClick(job.jobId)}
            >
              <div className="p-5 flex flex-col" style={{ height: '380px' }}>
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-white font-bold text-lg leading-tight flex-1 mr-3 line-clamp-2">
                    {job.title || t('music.untitledSong')}
                  </h3>
                  <span className="text-white/70 text-sm flex-shrink-0 mt-0.5">
                    {isLyricsOnly ? t('music.lyrics') : formatDuration(job.durationSeconds)}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.2) transparent' }}>
                  {sourceDiaries.map((diary) => {
                    const firstImage = diary.images && diary.images.length > 0 ? diary.images[0].imageUrl : null;
                    return (
                      <div
                        key={diary.id}
                        className="flex items-center gap-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="w-10 h-10 rounded-lg bg-white/20 flex-shrink-0 overflow-hidden">
                          {firstImage ? (
                            <StorageImage
                              url={firstImage}
                              alt="Diary"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/40">
                              <span className="text-sm">📝</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm truncate">
                            {getFirstLine(diary) || t('music.diaryTitlePlaceholder')}
                          </p>
                          <p className="text-white/50 text-xs">
                            {format(new Date(diary.date), 'M/d (EEE)', { locale })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {sourceDiaries.length === 0 && (
                    <p className="text-white/40 text-sm">{t('music.noDiariesLinked')}</p>
                  )}
                </div>

                {job.status === 'completed' && job.audioUrl && (
                  <div className="flex justify-end mt-3 pt-2">
                    <button
                      type="button"
                      onClick={(e) => onDownload(e, job)}
                      className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                    >
                      <Download className="w-4 h-4 text-white" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {jobs.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-1">
          {jobs.map((_, idx) => (
            <button
              key={idx}
              onClick={() => scrollToIndex(idx)}
              className={`rounded-full transition-all duration-300 ${
                idx === activeIndex
                  ? 'w-5 h-2'
                  : 'w-2 h-2 bg-gray-300'
              }`}
              style={idx === activeIndex ? { backgroundColor: getCardDotColor(idx) } : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function getFirstLine(diary: Diary): string {
  if (diary.title?.trim()) return diary.title.trim();
  if (diary.type === 'question_based' && diary.answers?.length) {
    const firstQuestion = diary.answers[0].question?.question?.trim();
    if (firstQuestion) return firstQuestion;
    const first = diary.answers[0].answer?.trim();
    if (first) {
      const tmp = document.createElement('div');
      tmp.innerHTML = first;
      const text = tmp.textContent || tmp.innerText || '';
      return text.split('\n')[0].trim() || text;
    }
  }
  if (diary.content?.trim()) {
    const tmp = document.createElement('div');
    tmp.innerHTML = diary.content;
    const text = tmp.textContent || tmp.innerText || '';
    return text.split('\n')[0].trim() || text;
  }
  return '';
}

export function MusicHomePage() {
  const navigate = useNavigate();
  const t = useT();
  const locale = getDateLocale();
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
  const activeSubscription = getEffectiveSubscription(subscriptions);
  const subscriptionStartDate = activeSubscription?.startDate;
  const completedJobs = jobs.filter((j) => j.status === 'completed' || j.status === 'lyrics_only');

  const diaryMap = useMemo(() => {
    const map = new Map<string, Diary>();
    diariesAll.forEach((d) => map.set(d.id, d));
    return map;
  }, [diariesAll]);

  const formatDuration = (seconds?: number) => {
    if (seconds == null) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleDownload = async (e: React.MouseEvent, job: MusicJobListItem) => {
    e.stopPropagation();
    try {
      const response = await fetch(job.audioUrl!);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      const filename = `${(job.title || 'music').replace(/[^a-zA-Z0-9가-힣\s]/g, '').replace(/\s+/g, '_')}.mp3`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
      window.open(job.audioUrl, '_blank');
    }
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
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">{t('music.generateTitle')}</h1>
          <ProfileButton />
        </div>

        <div className="bg-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs px-3 py-1 bg-gray-200 rounded-full font-bold text-gray-700">Mureka</span>
            <span className="text-xs text-gray-600">
              {subscriptionStartDate
                ? t('music.paymentDate', { date: format(new Date(subscriptionStartDate), 'M/d', { locale }) })
                : t('music.paymentDateLabel')}
            </span>
          </div>
          <div className="mb-2">
            <p className="text-sm text-gray-600 mb-2">{t('music.monthlyAvailable')}</p>
            <p className="text-3xl font-bold text-gray-900">{monthlyUsed}/{MONTHLY_LIMIT}</p>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            {t('music.totalDiaries', { count: diariesAll.length })}
          </p>
          <Button
            onClick={handleOpenCreateModal}
            disabled={!hasSubscription || monthlyUsed >= MONTHLY_LIMIT}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-900 py-3 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <span>{t('music.generateTitle')}</span>
            <Sparkles className="w-4 h-4" />
          </Button>
          {!hasSubscription && (
            <p className="text-xs text-amber-700 mt-2 text-center">
              {t('music.subscriptionRequired')}
            </p>
          )}
        </div>
      </div>

      <section className="max-w-md mx-auto space-y-6">
        <div className="flex items-center justify-between px-4">
          <h2 className="text-lg font-semibold text-gray-900">{t('music.myMusic')}</h2>
          {completedJobs.length > 0 && (
            <button
              onClick={() => navigate('/music/list')}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          )}
        </div>

        {completedJobs.length === 0 ? (
          <div className="mx-4 bg-white rounded-2xl p-8 shadow-sm text-center">
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
            <p className="font-medium text-brown-900 mb-2">{t('music.noMusicYet')}</p>
            <p className="text-sm text-muted-foreground">
              {t('music.noMusicDesc')}
            </p>
          </div>
        ) : (
          <MusicCardCarousel
            jobs={completedJobs}
            diaryMap={diaryMap}
            onCardClick={(jobId) => navigate(`/music/jobs/${jobId}`)}
            onDownload={handleDownload}
            formatDuration={formatDuration}
            t={t}
          />
        )}
      </section>

      {completedJobs.length > 0 && (
        <section className="max-w-md mx-auto px-4 mt-6 pb-4 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">{t('music.quickPick')}</h2>
          <div className="space-y-2">
            {completedJobs.map((job, index) => {
              const isLyricsOnly = job.status === 'lyrics_only';
              const firstDiary = (job.sourceDiaryIds || []).map((id) => diaryMap.get(id)).find(Boolean);
              const firstImage = firstDiary?.images?.[0]?.imageUrl;

              return (
                <button
                  key={job.jobId}
                  type="button"
                  onClick={() => navigate(`/music/jobs/${job.jobId}`)}
                  className="w-full flex items-center gap-3 bg-white rounded-xl p-3 text-left hover:bg-gray-50 transition-colors animate-slide-up menu-item-tap"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <div className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden bg-[#E8DDD3]">
                    {firstImage ? (
                      <StorageImage
                        url={firstImage}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play className="w-5 h-5 text-[#8B7355]" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate text-sm">
                      {job.title || t('music.untitledSong')}
                    </p>
                    <p className="text-xs text-gray-400">
                      {isLyricsOnly ? t('music.lyrics') : formatDuration(job.durationSeconds)}
                    </p>
                  </div>
                  {job.status === 'completed' && job.audioUrl && (
                    <div
                      role="button"
                      onClick={(e) => handleDownload(e, job)}
                      className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 flex-shrink-0"
                    >
                      <Play className="w-3.5 h-3.5 text-gray-600" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
