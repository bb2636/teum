import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, XCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMusicJob } from '@/hooks/useMusic';
import { useDiaries } from '@/hooks/useDiaries';
import { StorageImage } from '@/components/StorageImage';
import { format } from 'date-fns';
import { getDateLocale } from '@/lib/dateFnsLocale';
import { useT } from '@/hooks/useTranslation';
import { getFirstLine } from '@/lib/utils';
import { downloadMusicFile } from '@/lib/downloadMusic';

export function MusicJobPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const t = useT();
  const locale = getDateLocale();
  const { data: job, isLoading, error } = useMusicJob(jobId || '');
  const { data: diariesAll = [] } = useDiaries();
  const [showCompletionPopup, setShowCompletionPopup] = useState(false);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!job || isDownloading) return;
    setIsDownloading(true);
    try {
      await downloadMusicFile(job.jobId, job.title, job.audioUrl);
    } catch (err: any) {
      console.error('Download failed:', err);
    } finally {
      setIsDownloading(false);
    }
  };
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wasProcessingRef = useRef(false);
  
  const formatDuration = (seconds?: number) => {
    if (seconds == null) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };
  
  const sourceDiaries = job?.sourceDiaryIds
    ? job.sourceDiaryIds
        .map((id) => diariesAll.find((d) => d.id === id))
        .filter(Boolean)
    : [];

  useEffect(() => {
    setAudioDuration(null);
    if (job?.audioUrl && job.status === 'completed') {
      const audio = new Audio();
      audioRef.current = audio;
      audio.preload = 'metadata';
      const onLoaded = () => {
        if (audio.duration && isFinite(audio.duration)) {
          setAudioDuration(Math.round(audio.duration));
        }
      };
      const onError = () => {
        setAudioDuration(null);
      };
      audio.addEventListener('loadedmetadata', onLoaded);
      audio.addEventListener('error', onError);
      audio.src = job.audioUrl;
      return () => {
        audio.removeEventListener('loadedmetadata', onLoaded);
        audio.removeEventListener('error', onError);
        audio.src = '';
        audioRef.current = null;
      };
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, [job?.audioUrl, job?.status]);

  useEffect(() => {
    if (job?.status === 'processing' || job?.status === 'queued') {
      wasProcessingRef.current = true;
    }
  }, [job?.status]);

  useEffect(() => {
    if (!jobId) return;
    if (job?.status !== 'completed' && job?.status !== 'lyrics_only') return;
    if (!wasProcessingRef.current) return;
    const key = `music_completion_seen_${jobId}`;
    if (localStorage.getItem(key)) return;
    setShowCompletionPopup(true);
  }, [job?.status, jobId]);

  const handleCloseCompletionPopup = () => {
    if (jobId) localStorage.setItem(`music_completion_seen_${jobId}`, '1');
    setShowCompletionPopup(false);
  };

  if (isLoading && !job) {
    return (
      <div className="min-h-screen bg-beige-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-brown-600 mx-auto mb-4" />
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-beige-50 pb-20">
        <div className="max-w-md mx-auto px-4 py-6" style={{ paddingTop: 'max(24px, env(safe-area-inset-top, 24px))' }}>
          <Button variant="ghost" size="icon" onClick={() => navigate('/music')} className="mb-4">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="text-center py-12">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-muted-foreground">{t('music.cannotLoad')}</p>
          </div>
        </div>
      </div>
    );
  }

  const isProcessing = job.status === 'processing' || job.status === 'queued';
  const title = job.title || job.lyricalTheme || t('diary.noTitle');
  const titleEn = job.titleEn;

  return (
    <div className="min-h-screen bg-beige-50 pb-20">
      <div className="max-w-md mx-auto px-4 py-6 space-y-6" style={{ paddingTop: 'max(24px, env(safe-area-inset-top, 24px))' }}>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/music')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-brown-900">{t('music.detail')}</h1>
        </div>

        {isProcessing && (
          <div className="fixed inset-0 z-50 bg-[#4A2C1A] flex flex-col items-center justify-center animate-overlay-fade">
            <div className="text-center space-y-6 px-8">
              <div className="flex justify-center space-x-2">
                <div className="w-3 h-3 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-3 h-3 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-3 h-3 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <h2 className="text-xl font-semibold text-white">{t('music.processingTitle')}</h2>
              <p className="text-sm text-white/70">
                {t('music.processingDesc').split('\n').map((line, i) => (
                  <span key={i}>{line}<br /></span>
                ))}
              </p>
              <p className="text-xs text-white/50 mt-8">
                {t('music.processingTime')}
              </p>
            </div>
          </div>
        )}

        {(job.status === 'completed' || job.status === 'lyrics_only') && showCompletionPopup && (
          <div className="fixed inset-0 z-50 bg-white flex flex-col animate-overlay-fade">
            <div className="flex-1 overflow-y-auto px-6 pt-12 pb-6">
              <div className="max-w-sm mx-auto">
                <div className="text-center space-y-2 mb-6">
                  <h3 className="font-semibold text-lg text-brown-900">
                    {job.status === 'lyrics_only' ? t('music.lyricsComplete') : t('music.songArrived')}
                  </h3>
                  {title && title !== t('diary.noTitle') && (
                    <div className="space-y-1">
                      <p className="font-medium text-brown-900">{title}</p>
                      {titleEn && (
                        <p className="text-sm text-muted-foreground">{titleEn}</p>
                      )}
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {job.status === 'lyrics_only'
                      ? t('music.lyricsOnlyDesc')
                      : t('music.downloadDesc')}
                  </p>
                </div>
                <div className="rounded-xl border border-brown-100 bg-gray-50 p-4 min-h-[120px]">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">
                    {job.lyrics || t('music.lyricsPlaceholder')}
                  </pre>
                </div>
              </div>
            </div>
            <div className="px-6 pb-8 pt-4 max-w-sm mx-auto w-full">
              <div className="flex gap-3">
                {job.status === 'completed' && job.audioUrl && (
                  <Button
                    className="flex-1 bg-[#4A2C1A] hover:bg-[#3A2010] rounded-full"
                    disabled={isDownloading}
                    onTouchEnd={(e) => { e.preventDefault(); handleDownload(); }}
                    onClick={handleDownload}
                  >
                    {isDownloading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    {isDownloading ? t('music.downloading') || '다운로드 중...' : t('music.download')}
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  className={`${job.status === 'lyrics_only' ? 'w-full' : 'flex-1'} border-0 rounded-full`}
                  onClick={() => {
                    handleCloseCompletionPopup();
                    navigate('/music');
                  }}
                >
                  {t('music.addToMyMusic')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {job.status === 'failed' && (
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <XCircle className="w-6 h-6 text-red-600" />
              <h2 className="font-semibold text-brown-900">{t('music.generationFailed')}</h2>
            </div>
            <p className="text-sm text-red-700 mb-4">
              {job.errorMessage || t('music.failedMessage')}
            </p>
            <Button variant="outline" className="border-0 rounded-full" onClick={() => navigate('/music')}>
              {t('music.backToList')}
            </Button>
          </div>
        )}

        {job.status === 'lyrics_only' && (
          <>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-xl font-bold text-brown-900 mb-0.5">{title}</h2>
              {titleEn && (
                <p className="text-sm text-muted-foreground mb-1">{titleEn}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {format(new Date(job.createdAt), 'yyyy.MM.dd', { locale })}
              </p>
              <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-700">
                  {t('music.lyricsOnlyDesc')}
                </p>
              </div>
            </div>

            {job.lyrics && (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-brown-900 mb-4">{t('music.lyrics')}</h3>
                <pre className="whitespace-pre-wrap text-sm text-brown-800 font-sans leading-relaxed">
                  {job.lyrics}
                </pre>
              </div>
            )}

            {sourceDiaries.length > 0 && (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-brown-900 mb-4">{t('music.sourceDiaries')}</h3>
                <div className="space-y-3">
                  {sourceDiaries.map((diary) => {
                    if (!diary) return null;
                    const firstImage = diary.images && diary.images.length > 0 ? diary.images[0].imageUrl : null;
                    return (
                      <button
                        key={diary.id}
                        type="button"
                        onClick={() => navigate(`/diaries/${diary.id}`)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-brown-50 transition-colors text-left"
                      >
                        <div className="w-16 h-16 rounded-lg bg-[#f5f0eb] flex-shrink-0 overflow-hidden">
                          {firstImage ? (
                            <StorageImage
                              url={firstImage}
                              alt="Diary"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <img src="/logo.png" alt="teum" className="w-10 h-10 object-contain opacity-30" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-brown-900 truncate mb-1">
                            {getFirstLine(diary) || t('music.diaryTitlePlaceholder')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(diary.date), 'yyyy.MM.dd (EEE)', { locale })}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <Button variant="outline" className="w-full border-0 rounded-full" onClick={() => navigate('/music')}>
              {t('music.backToList')}
            </Button>
          </>
        )}

        {job.status === 'completed' && (
          <>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-xl font-bold text-brown-900 mb-0.5">{title}</h2>
              {titleEn && (
                <p className="text-sm text-muted-foreground mb-1">{titleEn}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {format(new Date(job.createdAt), 'yyyy.MM.dd', { locale })}
              </p>
            </div>

            {job.audioUrl && (
              <div className="bg-white rounded-xl p-6 shadow-sm space-y-4">
                <Button
                  className="w-full bg-[#4A2C1A] hover:bg-[#3a2114] text-white rounded-full py-3"
                  disabled={isDownloading}
                  onTouchEnd={(e) => { e.preventDefault(); handleDownload(); }}
                  onClick={handleDownload}
                >
                  {isDownloading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  {isDownloading ? t('music.downloading') || '다운로드 중...' : t('music.download')}
                </Button>
              </div>
            )}

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('music.songLength')}</span>
                <span className="font-medium text-brown-900">
                  {formatDuration(audioDuration ?? job.durationSeconds)}
                </span>
              </div>
            </div>

            {job.lyrics && (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-brown-900 mb-4">{t('music.lyrics')}</h3>
                <pre className="whitespace-pre-wrap text-sm text-brown-800 font-sans leading-relaxed">
                  {job.lyrics}
                </pre>
              </div>
            )}

            {sourceDiaries.length > 0 && (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-brown-900 mb-4">{t('music.sourceDiaries')}</h3>
                <div className="space-y-3">
                  {sourceDiaries.map((diary) => {
                    if (!diary) return null;
                    const firstImage = diary.images && diary.images.length > 0 ? diary.images[0].imageUrl : null;
                    return (
                      <button
                        key={diary.id}
                        type="button"
                        onClick={() => navigate(`/diaries/${diary.id}`)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-brown-50 transition-colors text-left"
                      >
                        <div className="w-16 h-16 rounded-lg bg-[#f5f0eb] flex-shrink-0 overflow-hidden">
                          {firstImage ? (
                            <StorageImage
                              url={firstImage}
                              alt="Diary"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <img src="/logo.png" alt="teum" className="w-10 h-10 object-contain opacity-30" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-brown-900 truncate mb-1">
                            {getFirstLine(diary) || t('music.diaryTitlePlaceholder')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(diary.date), 'yyyy.MM.dd (EEE)', { locale })}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <Button variant="outline" className="w-full border-0 rounded-full" onClick={() => navigate('/music')}>
              {t('music.tryAgain')}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
