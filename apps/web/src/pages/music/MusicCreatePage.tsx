import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Loader2, Download, ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDiaries, useFolders } from '@/hooks/useDiaries';
import { useGenerateMusic, useMusicGenres } from '@/hooks/useMusic';
import { useHideTabBar } from '@/contexts/HideTabBarContext';
import { format } from 'date-fns';
import { getDateLocale } from '@/lib/dateFnsLocale';
import { StorageImage } from '@/components/StorageImage';
import { useT } from '@/hooks/useTranslation';
import { getFirstLine } from '@/lib/utils';

export function MusicCreatePage() {
  const navigate = useNavigate();
  const t = useT();
  const locale = getDateLocale();
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
        setToastMessage(t('music.selectDiariesRequired'));
        setTimeout(() => setToastMessage(null), 3000);
      } else if (selectedGenres.length === 0) {
        setToastMessage(t('music.selectGenreRequired'));
        setTimeout(() => setToastMessage(null), 3000);
      }
      return;
    }

    setShowProcessingModal(true);

    try {
      const result = await generateMusic.mutateAsync({
        diaryIds: selectedDiaryIds,
        genreTag: selectedGenres[0],
      });

      setShowProcessingModal(false);
      
      if (result.status === 'completed' && result.audioUrl) {
        setCompletedJobId(result.jobId);
        setCompletedLyrics(result.lyrics || t('music.lyricsPlaceholder'));
        setCompletedTitle(result.title || '');
        setCompletedTitleEn(result.titleEn || '');
        setIsLyricsOnly(false);
        setShowCompletionModal(true);
      } else if (result.status === 'lyrics_only') {
        setCompletedJobId(result.jobId);
        setCompletedLyrics(result.lyrics || t('music.lyricsPlaceholder'));
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
        setToastMessage(t('music.monthlyLimitReached'));
        setTimeout(() => setToastMessage(null), 3000);
        return;
      }
      if (isQuotaError) {
        setToastMessage(t('music.quotaExceeded'));
        setTimeout(() => setToastMessage(null), 3000);
        return;
      }
      
      console.error('Failed to generate music:', error);
      setToastMessage(t('music.generateFailed'));
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

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
      window.open(url, '_blank');
    }
  };

  const handleDownload = async () => {
    if (!completedJobId) return;
    try {
      const apiBase = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${apiBase}/music/jobs/${completedJobId}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to get job');
      const result = await response.json();
      if (result.data?.audioUrl) {
        const title = result.data.title || completedTitle || 'music';
        const filename = `${title.replace(/[^a-zA-Z0-9가-힣\s]/g, '').replace(/\s+/g, '_')}.mp3`;
        await downloadFile(result.data.audioUrl, filename);
      } else {
        navigate(`/music/jobs/${completedJobId}`);
      }
    } catch (error) {
      console.error('Failed to get job info:', error);
      navigate(`/music/jobs/${completedJobId}`);
    }
  };

  const handleAddToMyMusic = () => {
    setShowCompletionModal(false);
    navigate('/music');
  };

  const getSelectedGenreLabels = () => {
    return selectedGenres
      .map((tag) => genres.find((g) => g.tag === tag)?.labelKo)
      .filter(Boolean)
      .join(', ');
  };

  return (
    <div className="min-h-screen bg-beige-50">
      <div className="sticky top-0 z-10 bg-white border-b border-brown-100 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-brown-900">{t('music.generateTitle')}</h1>
        <button
          onClick={() => navigate('/music')}
          className="p-2 rounded-full hover:bg-gray-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-4 py-4 space-y-4">
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
                  : t('music.selectGenre')}
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

        <div className="space-y-2">
          <h2 className="text-sm font-medium text-brown-900">{t('music.diarySection')}</h2>

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
              {t('common.all')}
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

          <div className="flex items-center justify-end">
            <select className="text-xs text-muted-foreground bg-transparent border-none focus:outline-none">
              <option>{t('music.sortNewest')}</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          {diaries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t('music.noDiariesAvailable')}</p>
          ) : (
            diaries.map((diary) => {
              const isSelected = selectedDiaryIds.includes(diary.id);
              const firstImage = diary.images && diary.images.length > 0 ? diary.images[0].imageUrl : null;

              return (
                <div
                  key={diary.id}
                  className="flex items-center gap-3 bg-white border border-brown-100 rounded-xl p-3"
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
                        <span className="text-xs">📝</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-brown-900 truncate mb-1">
                      {getFirstLine(diary) || t('music.diaryTitlePlaceholder')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(diary.date), 'M/d (EEE)', { locale })}
                    </p>
                  </div>

                  <Button
                    variant={isSelected ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleDiarySelection(diary.id)}
                    disabled={!isSelected && selectedCount >= 7}
                    className={isSelected ? 'bg-[#665146] hover:bg-[#5A453A]' : ''}
                  >
                    {isSelected ? t('common.deselect') : t('common.select')}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-brown-100 p-4">
        <Button
          onClick={handleGenerate}
          disabled={!canGenerate || generateMusic.isPending}
          className="w-full bg-[#665146] hover:bg-[#5A453A] text-white py-3 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generateMusic.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t('music.generatingShort')}
            </>
          ) : (
            t('music.generateCount', { count: selectedCount })
          )}
        </Button>
      </div>

      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-gray-800 text-white text-sm px-6 py-3 rounded-lg shadow-xl max-w-sm mx-4 animate-slide-up whitespace-nowrap">
            <p className="text-center">{toastMessage}</p>
          </div>
        </div>
      )}

      {showProcessingModal && (
        <div className="fixed inset-0 z-50 bg-[#665146] flex flex-col items-center justify-center animate-overlay-fade">
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

      {showCompletionModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-overlay-fade">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full max-h-[85vh] flex flex-col animate-modal-pop">
            <div className="text-center space-y-2 mb-4">
              <h2 className="text-lg font-semibold text-brown-900">
                {isLyricsOnly ? t('music.lyricsComplete') : t('music.songArrived')}
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
                  ? t('music.lyricsOnlyDesc')
                  : t('music.downloadDesc')}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto rounded-xl border border-brown-100 bg-gray-50 p-4 mb-4 min-h-[120px]">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">
                {completedLyrics || t('music.lyricsPlaceholder')}
              </pre>
            </div>

            <div className="flex gap-2">
              {!isLyricsOnly && (
                <Button
                  onClick={handleDownload}
                  className="flex-1 bg-[#665146] hover:bg-[#5A453A] text-white"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {t('music.download')}
                </Button>
              )}
              <Button
                onClick={handleAddToMyMusic}
                variant="outline"
                className={`${isLyricsOnly ? 'w-full' : 'flex-1'} border-0 text-brown-700 hover:bg-brown-50 rounded-full`}
              >
                {t('music.addToMyMusic')}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="h-32" />
    </div>
  );
}
