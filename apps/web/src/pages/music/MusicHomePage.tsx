import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Music, Loader2, Download, Sprout, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDiaries, useFolders } from '@/hooks/useDiaries';
import { useGenerateMusic, useMusicGenres, useMusicJobs } from '@/hooks/useMusic';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const MONTHLY_LIMIT = 5;

export function MusicHomePage() {
  const navigate = useNavigate();
  const { data: jobsData } = useMusicJobs();
  const { data: genresData } = useMusicGenres();
  const { data: diariesAll = [] } = useDiaries();
  const { data: folders = [] } = useFolders();
  const generateMusic = useGenerateMusic();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(undefined);
  const [selectedDiaryIds, setSelectedDiaryIds] = useState<string[]>([]);
  const [selectedGenreTag, setSelectedGenreTag] = useState<string>('');

  const diaries = selectedFolderId
    ? diariesAll.filter((d) => d.folderId === selectedFolderId)
    : diariesAll;

  const jobs = jobsData?.jobs ?? [];
  const monthlyUsed = jobsData?.monthlyUsed ?? 0;
  const hasSubscription = jobsData?.hasSubscription ?? false;
  const nextPaymentDate = jobsData?.nextPaymentDate;
  const completedJobs = jobs.filter((j) => j.status === 'completed');

  const formatDuration = (seconds?: number) => {
    if (seconds == null) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getFirstDiaryTitle = (job: { sourceDiaryIds: string[] }) => {
    const firstId = job.sourceDiaryIds?.[0];
    if (!firstId) return '일기 제목이 들어갑니다.';
    const diary = diariesAll.find((d) => d.id === firstId);
    return diary?.title || '일기 제목이 들어갑니다.';
  };

  const toggleDiarySelection = (diaryId: string) => {
    setSelectedDiaryIds((prev) => {
      if (prev.includes(diaryId)) {
        return prev.filter((id) => id !== diaryId);
      }
      if (prev.length >= 7) return prev;
      return [...prev, diaryId];
    });
  };

  const handleOpenCreateModal = () => {
    if (!hasSubscription) {
      navigate('/payment');
      return;
    }
    if (monthlyUsed >= MONTHLY_LIMIT) {
      return;
    }
    setSelectedDiaryIds([]);
    setSelectedFolderId(undefined);
    setSelectedGenreTag('');
    setCreateModalOpen(true);
  };

  const handleGenerate = async () => {
    if (selectedDiaryIds.length !== 7 || !selectedGenreTag) return;
    try {
      const result = await generateMusic.mutateAsync({
        diaryIds: selectedDiaryIds,
        genreTag: selectedGenreTag,
      });
      setCreateModalOpen(false);
      setSelectedDiaryIds([]);
      setSelectedGenreTag('');
      navigate(`/music/jobs/${result.jobId}`);
    } catch (error) {
      const err = error as Error & { code?: string };
      if (err.code === 'SUBSCRIPTION_REQUIRED') {
        setCreateModalOpen(false);
        navigate('/payment');
        return;
      }
      if (err.code === 'MONTHLY_LIMIT_EXCEEDED') {
        setCreateModalOpen(false);
        alert('이번 달 생성 한도(5곡)를 모두 사용했습니다.');
        return;
      }
      console.error('Failed to generate music:', error);
      alert('음악 생성에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const selectedCount = selectedDiaryIds.length;
  const genres = genresData?.genres ?? [];
  const canGenerate = selectedCount === 7 && !!selectedGenreTag;

  return (
    <div className="min-h-screen bg-beige-50 pb-20">
      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* 상단 Mureka 카드 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-brown-900">Mureka</span>
            <span className="text-xs text-muted-foreground">
              {nextPaymentDate
                ? `결제일 ${format(new Date(nextPaymentDate), 'M월 d일', { locale: ko })}`
                : '결제일'}
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
            className="w-full bg-brown-600 hover:bg-brown-700 text-white py-3 font-medium"
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
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
              {completedJobs.map((job) => (
                <button
                  key={job.jobId}
                  type="button"
                  onClick={() => navigate(`/music/jobs/${job.jobId}`)}
                  className="flex-shrink-0 w-40 bg-white rounded-xl p-4 shadow-sm text-left hover:shadow-md transition-shadow"
                >
                  <p className="font-medium text-brown-900 truncate mb-0.5">
                    {job.title || '노래 제목이 들어갑니다.'}
                  </p>
                  {job.titleEn && (
                    <p className="text-xs text-muted-foreground truncate mb-1">
                      {job.titleEn}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mb-2">
                    {formatDuration(job.durationSeconds)}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="w-8 h-8 rounded bg-brown-100 flex items-center justify-center">
                      <Music className="w-4 h-4 text-brown-600" />
                    </div>
                    <span className="truncate">{getFirstDiaryTitle(job)}</span>
                  </div>
                  {job.audioUrl && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(job.audioUrl, '_blank');
                      }}
                      className="mt-2 w-8 h-8 rounded-full border border-brown-200 flex items-center justify-center"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 음악 생성 모달: 일기 7개 선택 */}
      {createModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setCreateModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-brown-100">
              <h2 className="text-lg font-semibold text-brown-900">음악 생성</h2>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="p-2 rounded-full hover:bg-brown-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3 flex-1 min-h-0 flex flex-col overflow-hidden">
              <p className="text-sm text-muted-foreground">장르</p>
              <select
                value={selectedGenreTag}
                onChange={(e) => setSelectedGenreTag(e.target.value)}
                className="w-full px-3 py-2.5 border border-brown-200 rounded-lg text-sm bg-white text-brown-900 focus:outline-none focus:ring-2 focus:ring-brown-500 focus:border-transparent"
              >
                <option value="">장르를 선택하세요</option>
                {genres.map((g) => (
                  <option key={g.tag} value={g.tag}>
                    {g.labelKo} ({g.tag})
                  </option>
                ))}
              </select>
              <p className="text-sm text-muted-foreground">일기</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setSelectedFolderId(undefined)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium ${
                    selectedFolderId === undefined
                      ? 'bg-brown-600 text-white'
                      : 'bg-brown-100 text-brown-700'
                  }`}
                >
                  전체
                </button>
                {folders.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFolderId(f.id)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium ${
                      selectedFolderId === f.id
                        ? 'bg-brown-600 text-white'
                        : 'bg-brown-100 text-brown-700'
                    }`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
              <div className="text-xs text-muted-foreground">최신순</div>
              {(!selectedGenreTag || selectedCount < 7) && (
                <p className="text-sm text-brown-800 bg-brown-50 rounded-lg px-3 py-2">
                  {!selectedGenreTag
                    ? '장르를 선택하고 일기 7개를 선택해주세요.'
                    : '음악을 생성하려면 일기를 7개 선택해주세요.'}
                </p>
              )}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {diaries.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">일기가 없습니다.</p>
                ) : (
                  diaries.map((diary) => {
                    const isSelected = selectedDiaryIds.includes(diary.id);
                    return (
                      <div
                        key={diary.id}
                        className="flex items-center gap-3 bg-white border border-brown-100 rounded-xl p-3"
                      >
                        <div className="w-10 h-10 rounded-lg bg-brown-100 flex items-center justify-center flex-shrink-0">
                          <Music className="w-5 h-5 text-brown-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-brown-900 truncate">
                            {diary.title || '일기 제목이 들어갑니다.'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(diary.date), 'M월 d일 (EEE)', { locale: ko })}
                          </p>
                        </div>
                        <Button
                          variant={isSelected ? 'secondary' : 'outline'}
                          size="sm"
                          onClick={() => toggleDiarySelection(diary.id)}
                          disabled={!isSelected && selectedCount >= 7}
                        >
                          {isSelected ? '해제' : '선택'}
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
              <Button
                onClick={handleGenerate}
                disabled={!canGenerate || generateMusic.isPending}
                className="w-full bg-brown-600 hover:bg-brown-700 py-3"
              >
                {generateMusic.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    생성 중...
                  </>
                ) : (
                  `${selectedCount}/7 음악 생성하기 ✨`
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
