import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Loader2, Download, ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDiaries, useFolders } from '@/hooks/useDiaries';
import { useGenerateMusic, useMusicGenres } from '@/hooks/useMusic';
import { useHideTabBar } from '@/contexts/HideTabBarContext';
import { apiRequest } from '@/lib/api';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { StorageImage } from '@/components/StorageImage';

export function MusicCreatePage() {
  const navigate = useNavigate();
  const { setHideTabBar } = useHideTabBar();
  const { data: genresData } = useMusicGenres();
  const { data: diariesAll = [] } = useDiaries();
  const { data: folders = [] } = useFolders();
  const generateMusic = useGenerateMusic();

  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(undefined);
  const [selectedDiaryIds, setSelectedDiaryIds] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [showGenreDropdown, setShowGenreDropdown] = useState(false);
  const [showProcessingModal, setShowProcessingModal] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completedJobId, setCompletedJobId] = useState<string | null>(null);
  const [completedLyrics, setCompletedLyrics] = useState<string>('');
  const [completedTitle, setCompletedTitle] = useState<string>('');
  const [completedTitleEn, setCompletedTitleEn] = useState<string>('');
  const [isLyricsOnly, setIsLyricsOnly] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 하단바 숨기기
  useEffect(() => {
    setHideTabBar(true);
    return () => {
      setHideTabBar(false);
    };
  }, [setHideTabBar]);

  const diaries = selectedFolderId
    ? diariesAll.filter((d) => d.folderId === selectedFolderId)
    : diariesAll;

  const genres = genresData?.genres ?? [];
  const selectedCount = selectedDiaryIds.length;
  const canGenerate = selectedCount === 7 && selectedGenres.length > 0;

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

  // 폴더별 일기 개수 계산
  const getFolderDiaryCount = (folderId: string | undefined) => {
    if (folderId === undefined) return diariesAll.length;
    return diariesAll.filter((d) => d.folderId === folderId).length;
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

  const toggleGenre = (genreTag: string) => {
    setSelectedGenres((prev) => {
      if (prev.includes(genreTag)) {
        return prev.filter((tag) => tag !== genreTag);
      }
      return [...prev, genreTag];
    });
  };

  const handleGenerate = async () => {
    if (!canGenerate) {
      if (selectedCount < 7) {
        setToastMessage('음악을 생성하려면 일기를 7개 선택해주세요.');
        setTimeout(() => setToastMessage(null), 3000);
      } else if (selectedGenres.length === 0) {
        setToastMessage('장르를 선택해주세요.');
        setTimeout(() => setToastMessage(null), 3000);
      }
      return;
    }

    setShowProcessingModal(true);

    try {
      // 첫 번째 장르만 사용 (백엔드가 단일 장르만 받는 경우)
      const result = await generateMusic.mutateAsync({
        diaryIds: selectedDiaryIds,
        genreTag: selectedGenres[0], // 첫 번째 선택된 장르 사용
      });

      setShowProcessingModal(false);
      
      if (result.status === 'completed' && result.audioUrl) {
        setCompletedJobId(result.jobId);
        setCompletedLyrics(result.lyrics || '이곳에 가사가 들어갑니다.');
        setCompletedTitle(result.title || '');
        setCompletedTitleEn(result.titleEn || '');
        setIsLyricsOnly(false);
        setShowCompletionModal(true);
      } else if (result.status === 'lyrics_only') {
        setCompletedJobId(result.jobId);
        setCompletedLyrics(result.lyrics || '이곳에 가사가 들어갑니다.');
        setCompletedTitle(result.title || '');
        setCompletedTitleEn(result.titleEn || '');
        setIsLyricsOnly(true);
        setShowCompletionModal(true);
      } else {
        navigate(`/music/jobs/${result.jobId}`);
      }
    } catch (error) {
      setShowProcessingModal(false);
      const err = error as Error & { code?: string; message?: string };
      
      // 에러 메시지에서 Mureka quota 에러 감지
      const errorMessage = err.message || '';
      const isQuotaError = 
        err.code === 'MUREKA_QUOTA_EXCEEDED' ||
        errorMessage.includes('429') ||
        errorMessage.toLowerCase().includes('quota') ||
        errorMessage.toLowerCase().includes('exceeded');
      
      if (err.code === 'SUBSCRIPTION_REQUIRED') {
        navigate('/payment');
        return;
      }
      if (err.code === 'MONTHLY_LIMIT_EXCEEDED') {
        setToastMessage('이번 달 생성 한도(5곡)를 모두 사용했습니다.');
        setTimeout(() => setToastMessage(null), 3000);
        return;
      }
      if (isQuotaError) {
        setToastMessage('Mureka API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.');
        setTimeout(() => setToastMessage(null), 3000);
        return;
      }
      
      console.error('Failed to generate music:', error);
      setToastMessage('음악 생성에 실패했습니다. 다시 시도해주세요.');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  // 실제 파일 다운로드 함수
  const downloadFile = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback: 새 탭에서 열기
      window.open(url, '_blank');
    }
  };

  const handleDownload = async () => {
    if (!completedJobId) return;
    
    // Job 정보를 가져와서 audioUrl 확인
    try {
      const response = await apiRequest<{ data: { audioUrl?: string; title?: string } }>(
        `/music/jobs/${completedJobId}`
      );
      if (response.data.audioUrl) {
        const title = response.data.title || completedTitle || 'music';
        const filename = `${title.replace(/[^a-zA-Z0-9가-힣\s]/g, '').replace(/\s+/g, '_')}.mp3`;
        await downloadFile(response.data.audioUrl, filename);
      } else {
        // 아직 완료되지 않은 경우 상세 페이지로 이동
        navigate(`/music/jobs/${completedJobId}`);
      }
    } catch (error) {
      console.error('Failed to get job info:', error);
      // 에러 시 상세 페이지로 이동
      navigate(`/music/jobs/${completedJobId}`);
    }
  };

  const handleAddToMyMusic = () => {
    // 이미 내 음악 목록에 표시되므로, 음악 홈으로 이동
    setShowCompletionModal(false);
    navigate('/music');
  };

  // 선택된 장르 레이블 가져오기
  const getSelectedGenreLabels = () => {
    return selectedGenres
      .map((tag) => genres.find((g) => g.tag === tag)?.labelKo)
      .filter(Boolean)
      .join(', ');
  };

  return (
    <div className="min-h-screen bg-beige-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-brown-100 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-brown-900">음악 생성</h1>
        <button
          onClick={() => navigate('/music')}
          className="p-2 rounded-full hover:bg-gray-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* 장르 선택 */}
        <div className="space-y-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowGenreDropdown(!showGenreDropdown)}
              className="w-full px-4 py-3 bg-white border border-brown-200 rounded-lg text-left flex items-center justify-between hover:border-brown-400 transition-colors"
            >
              <span className={selectedGenres.length > 0 ? 'text-brown-900' : 'text-gray-400'}>
                {selectedGenres.length > 0
                  ? getSelectedGenreLabels()
                  : '장르를 선택하세요'}
              </span>
              <ChevronDown
                className={`w-5 h-5 text-gray-400 transition-transform ${
                  showGenreDropdown ? 'rotate-180' : ''
                }`}
              />
            </button>

            {showGenreDropdown && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShowGenreDropdown(false)}
                />
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-brown-200 rounded-lg shadow-lg z-30 max-h-60 overflow-y-auto">
                  {genres.map((genre) => {
                    const isSelected = selectedGenres.includes(genre.tag);
                    return (
                      <button
                        key={genre.tag}
                        type="button"
                        onClick={() => {
                          toggleGenre(genre.tag);
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-brown-50 flex items-center justify-between border-b border-brown-100 last:border-b-0"
                      >
                        <span className="text-brown-900">{genre.labelKo}</span>
                        {isSelected && <Check className="w-5 h-5 text-brown-600" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 일기 섹션 */}
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-brown-900">일기</h2>

          {/* 폴더 필터 */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
            <button
              type="button"
              onClick={() => setSelectedFolderId(undefined)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap flex items-center gap-1 ${
                selectedFolderId === undefined
                  ? 'bg-brown-900 text-white'
                  : 'bg-brown-100 text-brown-700'
              }`}
            >
              전체
              {selectedFolderId === undefined && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-brown-600 text-white text-[10px] rounded-full leading-none">
                  {diariesAll.length}
                </span>
              )}
            </button>
            {folders.map((f) => {
              const count = getFolderDiaryCount(f.id);
              const isSelected = selectedFolderId === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedFolderId(f.id)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap flex items-center gap-1 ${
                    isSelected
                      ? 'bg-brown-900 text-white'
                      : 'bg-brown-100 text-brown-700'
                  }`}
                >
                  {f.name}
                  {isSelected && count > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-brown-600 text-white text-[10px] rounded-full leading-none">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* 정렬 */}
          <div className="flex items-center justify-end">
            <select className="text-xs text-muted-foreground bg-transparent border-none focus:outline-none">
              <option>최신순</option>
            </select>
          </div>
        </div>

        {/* 일기 목록 */}
        <div className="space-y-2">
          {diaries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">일기가 없습니다.</p>
          ) : (
            diaries.map((diary) => {
              const isSelected = selectedDiaryIds.includes(diary.id);
              const firstImage = diary.images && diary.images.length > 0 ? diary.images[0].imageUrl : null;

              return (
                <div
                  key={diary.id}
                  className="flex items-center gap-3 bg-white border border-brown-100 rounded-xl p-3"
                >
                  {/* 썸네일 */}
                  <div className="w-16 h-16 rounded-lg bg-brown-100 flex-shrink-0 overflow-hidden">
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

                  {/* 내용 */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-brown-900 truncate mb-1">
                      {getFirstLine(diary) || '일기 제목이 들어갑니다.'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(diary.date), 'M월 d일 (EEE)', { locale: ko })}
                    </p>
                  </div>

                  {/* 선택 버튼 */}
                  <Button
                    variant={isSelected ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleDiarySelection(diary.id)}
                    disabled={!isSelected && selectedCount >= 7}
                    className={isSelected ? 'bg-[#665146] hover:bg-[#5A453A]' : ''}
                  >
                    {isSelected ? '해제' : '선택'}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 하단 고정 영역 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-brown-100 p-4">
        {/* 생성 버튼 */}
        <Button
          onClick={handleGenerate}
          disabled={!canGenerate || generateMusic.isPending}
          className="w-full bg-[#665146] hover:bg-[#5A453A] text-white py-3 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generateMusic.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              생성 중...
            </>
          ) : (
            `${selectedCount}/7 음악 생성하기`
          )}
        </Button>
      </div>

      {/* 토스트 메시지 */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-gray-800 text-white text-sm px-6 py-3 rounded-lg shadow-xl max-w-sm mx-4 animate-slide-up whitespace-nowrap">
            <p className="text-center">{toastMessage}</p>
          </div>
        </div>
      )}

      {/* 처리 중 모달 - 전체 화면 */}
      {showProcessingModal && (
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

      {showCompletionModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-overlay-fade">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full max-h-[85vh] flex flex-col animate-modal-pop">
            <div className="text-center space-y-2 mb-4">
              <h2 className="text-lg font-semibold text-brown-900">
                {isLyricsOnly ? '가사가 완성되었습니다' : '노래가 도착했습니다'}
              </h2>
              {completedTitle && (
                <div className="space-y-1">
                  <p className="font-medium text-brown-900">{completedTitle}</p>
                  {completedTitleEn && (
                    <p className="text-sm text-muted-foreground">{completedTitleEn}</p>
                  )}
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                {isLyricsOnly
                  ? '멜로디 생성은 실패했지만, AI가 작성한 가사를 확인할 수 있습니다.'
                  : '완성된 음악을 다운로드해 두면 언제든 다시 들을 수 있습니다.'}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto rounded-xl border border-brown-100 bg-gray-50 p-4 mb-4 min-h-[120px]">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">
                {completedLyrics || '이곳에 가사가 들어갑니다.'}
              </pre>
            </div>

            <div className="flex gap-2">
              {!isLyricsOnly && (
                <Button
                  onClick={handleDownload}
                  className="flex-1 bg-[#665146] hover:bg-[#5A453A] text-white"
                >
                  <Download className="w-4 h-4 mr-2" />
                  다운로드
                </Button>
              )}
              <Button
                onClick={handleAddToMyMusic}
                variant="outline"
                className={`${isLyricsOnly ? 'w-full' : 'flex-1'} border-0 text-brown-700 hover:bg-brown-50 rounded-full`}
              >
                담기
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 하단 여백 (고정 버튼 공간) */}
      <div className="h-32" />
    </div>
  );
}
