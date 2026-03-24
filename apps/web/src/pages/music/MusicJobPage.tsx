import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, XCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMusicJob } from '@/hooks/useMusic';
import { useDiaries } from '@/hooks/useDiaries';
import { StorageImage } from '@/components/StorageImage';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export function MusicJobPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { data: job, isLoading, error } = useMusicJob(jobId || '');
  const { data: diariesAll = [] } = useDiaries();
  const [showCompletionPopup, setShowCompletionPopup] = useState(false);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // 일기 첫 줄 추출 함수
  const getFirstLine = (diary: { title?: string; content?: string; type?: string; answers?: Array<{ answer?: string; question?: { question?: string } }> }) => {
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
      return '';
    }
    if (diary.content?.trim()) {
      const tmp = document.createElement('div');
      tmp.innerHTML = diary.content;
      const text = tmp.textContent || tmp.innerText || '';
      return text.trim().split('\n')[0].trim();
    }
    return '';
  };
  
  // 곡 길이 포맷팅
  const formatDuration = (seconds?: number) => {
    if (seconds == null) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };
  
  // 해당 음악의 바탕이 된 일기 목록
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
      audio.addEventListener('loadedmetadata', () => {
        if (audio.duration && isFinite(audio.duration)) {
          setAudioDuration(Math.round(audio.duration));
        }
      });
      audio.addEventListener('error', () => {
        setAudioDuration(null);
      });
      audio.src = job.audioUrl;
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, [job?.audioUrl, job?.status]);

  useEffect(() => {
    if (!jobId) return;
    if (job?.status !== 'completed' && job?.status !== 'lyrics_only') return;
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
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-beige-50 pb-20">
        <div className="max-w-md mx-auto px-4 py-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mb-4">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="text-center py-12">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-muted-foreground">음악 작업을 불러올 수 없습니다</p>
          </div>
        </div>
      </div>
    );
  }

  const isProcessing = job.status === 'processing' || job.status === 'queued';
  const title = job.title || job.lyricalTheme || '제목 없음';
  const titleEn = job.titleEn;

  return (
    <div className="min-h-screen bg-beige-50 pb-20">
      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/music')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-brown-900">음악 상세</h1>
        </div>

        {/* 로딩 팝업: 생성 중일 때 - 전체 화면 */}
        {isProcessing && (
          <div className="fixed inset-0 z-50 bg-[#665146] flex flex-col items-center justify-center animate-overlay-fade">
            <div className="text-center space-y-6 px-8">
              <div className="flex justify-center space-x-2">
                <div className="w-3 h-3 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-3 h-3 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-3 h-3 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <h2 className="text-xl font-semibold text-white">음악을 만들고 있습니다.</h2>
              <p className="text-sm text-white/70">
                선택한 일기의 감정을 분석하고<br />선율로 바꾸는 중입니다.
              </p>
              <p className="text-xs text-white/50 mt-8">
                최대 2~3분 정도 소요될 수 있습니다.
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
                    {job.status === 'lyrics_only' ? '가사가 완성되었습니다' : '노래가 도착했습니다'}
                  </h3>
                  {title && title !== '제목 없음' && (
                    <div className="space-y-1">
                      <p className="font-medium text-brown-900">{title}</p>
                      {titleEn && (
                        <p className="text-sm text-muted-foreground">{titleEn}</p>
                      )}
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {job.status === 'lyrics_only'
                      ? '멜로디 생성은 실패했지만, AI가 작성한 가사를 확인할 수 있습니다.'
                      : '완성된 음악을 다운로드해 두면 언제든 다시 들을 수 있습니다.'}
                  </p>
                </div>
                <div className="rounded-xl border border-brown-100 bg-gray-50 p-4 min-h-[120px]">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">
                    {job.lyrics || '이곳에 가사가 들어갑니다.'}
                  </pre>
                </div>
              </div>
            </div>
            <div className="px-6 pb-8 pt-4 max-w-sm mx-auto w-full">
              <div className="flex gap-3">
                {job.status === 'completed' && job.audioUrl && (
                  <Button
                    className="flex-1 bg-[#665146] hover:bg-[#5A453A] rounded-full"
                    onClick={async () => {
                      if (job.audioUrl) {
                        try {
                          const response = await fetch(job.audioUrl);
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
                      }
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    다운로드
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
                  담기
                </Button>
              </div>
            </div>
          </div>
        )}

        {job.status === 'failed' && (
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <XCircle className="w-6 h-6 text-red-600" />
              <h2 className="font-semibold text-brown-900">생성 실패</h2>
            </div>
            <p className="text-sm text-red-700 mb-4">
              {job.errorMessage || '음악 생성에 실패했습니다'}
            </p>
            <Button variant="outline" className="border-0 rounded-full" onClick={() => navigate('/music')}>
              목록으로
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
                {format(new Date(job.createdAt), 'yyyy.MM.dd', { locale: ko })}
              </p>
              <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-700">
                  멜로디 생성은 실패했지만, AI가 작성한 가사를 확인할 수 있습니다.
                </p>
              </div>
            </div>

            {job.lyrics && (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-brown-900 mb-4">가사</h3>
                <pre className="whitespace-pre-wrap text-sm text-brown-800 font-sans leading-relaxed">
                  {job.lyrics}
                </pre>
              </div>
            )}

            {sourceDiaries.length > 0 && (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-brown-900 mb-4">이 곡의 바탕이 된 일기</h3>
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
                        <div className="w-16 h-16 rounded-lg bg-brown-100 flex-shrink-0 overflow-hidden">
                          {firstImage ? (
                            <StorageImage
                              url={firstImage}
                              alt="Diary"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-brown-400">
                              <span className="text-lg">📝</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-brown-900 truncate mb-1">
                            {getFirstLine(diary) || '일기 제목이 들어갑니다.'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(diary.date), 'yyyy년 M월 d일 (EEE)', { locale: ko })}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <Button variant="outline" className="w-full border-0 rounded-full" onClick={() => navigate('/music')}>
              목록으로
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
                {format(new Date(job.createdAt), 'yyyy.MM.dd', { locale: ko })}
              </p>
            </div>

            {job.audioUrl && (
              <div className="bg-white rounded-xl p-6 shadow-sm space-y-4">
                <Button
                  className="w-full bg-[#4A2C1A] hover:bg-[#3a2114] text-white rounded-full py-3"
                  onClick={async () => {
                    if (job.audioUrl) {
                      try {
                        const response = await fetch(job.audioUrl);
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
                    }
                  }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  다운로드
                </Button>
              </div>
            )}

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">곡 길이</span>
                <span className="font-medium text-brown-900">
                  {formatDuration(audioDuration ?? job.durationSeconds)}
                </span>
              </div>
            </div>

            {job.lyrics && (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-brown-900 mb-4">가사</h3>
                <pre className="whitespace-pre-wrap text-sm text-brown-800 font-sans leading-relaxed">
                  {job.lyrics}
                </pre>
              </div>
            )}

            {sourceDiaries.length > 0 && (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-brown-900 mb-4">이 곡의 바탕이 된 일기</h3>
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
                        <div className="w-16 h-16 rounded-lg bg-brown-100 flex-shrink-0 overflow-hidden">
                          {firstImage ? (
                            <StorageImage
                              url={firstImage}
                              alt="Diary"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-brown-400">
                              <span className="text-lg">📝</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-brown-900 truncate mb-1">
                            {getFirstLine(diary) || '일기 제목이 들어갑니다.'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(diary.date), 'yyyy년 M월 d일 (EEE)', { locale: ko })}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <Button variant="outline" className="w-full border-0 rounded-full" onClick={() => navigate('/music')}>
              다시 만들기
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
