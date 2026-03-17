import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, XCircle, Play, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMusicJob } from '@/hooks/useMusic';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export function MusicJobPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { data: job, isLoading, error } = useMusicJob(jobId || '');
  const [showCompletionPopup, setShowCompletionPopup] = useState(false);

  // 완료 시 완성 팝업 이번 세션에서 한 번만 표시
  useEffect(() => {
    if (job?.status !== 'completed' || !jobId) return;
    const key = `music_completion_seen_${jobId}`;
    if (sessionStorage.getItem(key)) return;
    setShowCompletionPopup(true);
  }, [job?.status, jobId]);

  const handleCloseCompletionPopup = () => {
    if (jobId) sessionStorage.setItem(`music_completion_seen_${jobId}`, '1');
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
          <h1 className="text-xl font-bold text-brown-900">음악 생성</h1>
        </div>

        {/* 로딩 팝업: 생성 중일 때 */}
        {isProcessing && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-xl">
              <div className="flex justify-center gap-1 mb-4">
                <span className="w-2 h-2 rounded-full bg-brown-500 animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 rounded-full bg-brown-500 animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 rounded-full bg-brown-500 animate-bounce [animation-delay:300ms]" />
              </div>
              <p className="font-semibold text-brown-900 mb-2">음악을 만들고 있습니다.</p>
              <p className="text-sm text-muted-foreground">
                선택한 일기의 감정을 분석하고 선율로 바꾸는 중입니다.
              </p>
            </div>
          </div>
        )}

        {/* 완성 팝업: 노래 도착 + 가사 + 다운로드/닫기 */}
        {job.status === 'completed' && showCompletionPopup && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full max-h-[85vh] flex flex-col shadow-xl">
              <h3 className="font-semibold text-lg text-brown-900 mb-2">노래가 도착했습니다</h3>
              <p className="text-sm text-muted-foreground mb-4">
                완성된 음악을 다운로드해 두면 언제든 다시 들을 수 있습니다.
              </p>
              <div className="flex-1 overflow-y-auto rounded-xl border border-brown-100 bg-brown-50/50 p-4 mb-4 min-h-[120px]">
                <pre className="whitespace-pre-wrap text-sm text-brown-800 font-sans">
                  {job.lyrics || '이곳에 가사가 들어갑니다.'}
                </pre>
              </div>
              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-brown-600 hover:bg-brown-700"
                  onClick={() => {
                    if (job.audioUrl) window.open(job.audioUrl, '_blank');
                  }}
                >
                  다운로드
                </Button>
                <Button variant="outline" className="flex-1" onClick={handleCloseCompletionPopup}>
                  닫기
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 실패 시 */}
        {job.status === 'failed' && (
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <XCircle className="w-6 h-6 text-red-600" />
              <h2 className="font-semibold text-brown-900">생성 실패</h2>
            </div>
            <p className="text-sm text-red-700 mb-4">
              {job.errorMessage || '음악 생성에 실패했습니다'}
            </p>
            <Button variant="outline" onClick={() => navigate('/music')}>
              목록으로
            </Button>
          </div>
        )}

        {/* 완료 시: 멜론 스타일 제목 + 가사 상세 */}
        {job.status === 'completed' && (
          <>
            {/* 노래 제목 (멜론 스타일) - 한국어 + 영어 */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-xl font-bold text-brown-900 mb-0.5">{title}</h2>
              {titleEn && (
                <p className="text-sm text-muted-foreground mb-1">{titleEn}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {format(new Date(job.createdAt), 'yyyy.MM.dd', { locale: ko })}
              </p>
            </div>

            {/* 오디오 + 재생/다운로드 */}
            {job.audioUrl && (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <audio controls className="w-full mb-4">
                  <source src={job.audioUrl} type="audio/mpeg" />
                  <source src={job.audioUrl} type="audio/wav" />
                  브라우저가 오디오 재생을 지원하지 않습니다.
                </audio>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => window.open(job.audioUrl, '_blank')}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    다운로드
                  </Button>
                  <Button
                    className="flex-1 bg-brown-600 hover:bg-brown-700"
                    onClick={() => window.open(job.audioUrl, '_blank')}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    재생
                  </Button>
                </div>
              </div>
            )}

            {/* 가사 (멜론 스타일) */}
            {job.lyrics && (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-brown-900 mb-4">가사</h3>
                <pre className="whitespace-pre-wrap text-sm text-brown-800 font-sans leading-relaxed">
                  {job.lyrics}
                </pre>
              </div>
            )}

            <Button variant="outline" className="w-full" onClick={() => navigate('/music')}>
              다시 만들기
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
