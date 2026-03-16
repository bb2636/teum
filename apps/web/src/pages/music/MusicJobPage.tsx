import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Music, Loader2, CheckCircle2, XCircle, Play, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMusicJob } from '@/hooks/useMusic';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export function MusicJobPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { data: job, isLoading, error } = useMusicJob(jobId || '');

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

  const getStatusIcon = () => {
    switch (job.status) {
      case 'completed':
        return <CheckCircle2 className="w-6 h-6 text-green-600" />;
      case 'failed':
        return <XCircle className="w-6 h-6 text-red-600" />;
      case 'processing':
      case 'queued':
        return <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />;
      default:
        return <Music className="w-6 h-6 text-brown-600" />;
    }
  };

  const getStatusText = () => {
    switch (job.status) {
      case 'completed':
        return '완료';
      case 'failed':
        return '실패';
      case 'processing':
        return '생성 중...';
      case 'queued':
        return '대기 중...';
      default:
        return job.status;
    }
  };

  return (
    <div className="min-h-screen bg-beige-50 pb-20">
      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-brown-900">음악 생성</h1>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            {getStatusIcon()}
            <div className="flex-1">
              <h2 className="font-semibold text-brown-900">상태: {getStatusText()}</h2>
              <p className="text-xs text-muted-foreground">
                {format(new Date(job.createdAt), 'yyyy.MM.dd HH:mm', { locale: ko })}
              </p>
            </div>
          </div>

          {job.status === 'processing' || job.status === 'queued' ? (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">
                음악을 생성하고 있습니다. 잠시만 기다려주세요...
              </p>
            </div>
          ) : job.status === 'failed' ? (
            <div className="mt-4 p-3 bg-red-50 rounded-lg">
              <p className="text-sm text-red-700">
                {job.errorMessage || '음악 생성에 실패했습니다'}
              </p>
            </div>
          ) : null}
        </div>

        {/* Results */}
        {job.status === 'completed' && (
          <>
            {/* Audio Player */}
            {job.audioUrl && (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-brown-900 mb-4">생성된 음악</h3>
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
                </div>
              </div>
            )}

            {/* Analysis Results */}
            <div className="bg-white rounded-xl p-6 shadow-sm space-y-4">
              <h3 className="font-semibold text-brown-900">분석 결과</h3>

              {job.overallEmotion && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">전체 감정</p>
                  <p className="text-sm font-medium text-brown-900">{job.overallEmotion}</p>
                </div>
              )}

              {job.mood && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">분위기</p>
                  <p className="text-sm font-medium text-brown-900">{job.mood}</p>
                </div>
              )}

              {job.keywords && job.keywords.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">키워드</p>
                  <div className="flex flex-wrap gap-2">
                    {job.keywords.map((keyword, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-brown-100 text-brown-700 rounded-full text-xs"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {job.lyricalTheme && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">주제</p>
                  <p className="text-sm text-brown-800">{job.lyricalTheme}</p>
                </div>
              )}
            </div>

            {/* Lyrics */}
            {job.lyrics && (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-brown-900 mb-4">가사</h3>
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap text-sm text-brown-800 font-sans">
                    {job.lyrics}
                  </pre>
                </div>
              </div>
            )}

            {/* Music Prompt */}
            {job.musicPrompt && (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-brown-900 mb-2">음악 프롬프트</h3>
                <p className="text-sm text-muted-foreground">{job.musicPrompt}</p>
              </div>
            )}
          </>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => navigate('/music')}
          >
            다시 만들기
          </Button>
          {job.status === 'completed' && job.audioUrl && (
            <Button
              className="flex-1 bg-brown-600 hover:bg-brown-700"
              onClick={() => window.open(job.audioUrl, '_blank')}
            >
              <Play className="w-4 h-4 mr-2" />
              재생
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
