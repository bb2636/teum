import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Filter, ChevronDown, Pencil, Trash2, X, ArrowLeft, ChevronRight, Music, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StorageImage } from '@/components/StorageImage';
import { ProfileButton } from '@/components/ProfileButton';
import { useDiaries, useFolders, useDiaryCount } from '@/hooks/useDiaries';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useCreateFolder, useUpdateFolder, useDeleteFolder } from '@/hooks/useFolders';
import { useUploadImage } from '@/hooks/useUpload';
import { useSubscriptions, getEffectiveSubscription } from '@/hooks/usePayment';
import { useHideTabBar } from '@/contexts/HideTabBarContext';
import { format } from 'date-fns';
import { getDateLocale } from '@/lib/dateFnsLocale';
import { useT } from '@/hooks/useTranslation';
import { stripHTML } from '@/lib/utils';
import { Toast } from '@/components/Toast';
import { useTheme } from '@/contexts/ThemeContext';

type SortOrder = 'newest' | 'oldest';
type DiaryTypeFilter = 'all' | 'free_form' | 'question_based';

export function HomePage() {
  const { theme } = useTheme();
  const t = useT();
  const navigate = useNavigate();
  const { data: folders = [], isLoading: foldersLoading } = useFolders();
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(undefined);
  const { data: diaries = [], isLoading: diariesLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useDiaries(selectedFolderId);
  const { data: subscriptions = [] } = useSubscriptions();
  const { data: diaryCount = 0 } = useDiaryCount();
  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();
  const deleteFolder = useDeleteFolder();
  const uploadImage = useUploadImage();
  const { setHideTabBar } = useHideTabBar();
  
  // 필터 및 정렬 상태
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [typeFilter, setTypeFilter] = useState<DiaryTypeFilter>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  
  // 폴더 편집 상태
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState<string>('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<{ id: string; name: string } | null>(null);
  const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null);
  
  // 토스트 메시지 상태 (여러 개 표시 가능)
  const [toastMessages, setToastMessages] = useState<Array<{ id: string; message: string }>>([]);
  
  // 폴더 생성 모달 상태
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [uploadErrorToast, setUploadErrorToast] = useState(false);
  const [showFolderLimitModal, setShowFolderLimitModal] = useState(false);

  const scrollSentinelRef = useInfiniteScroll({
    hasMore: hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });
  
  // 폴더 생성 모달이 열릴 때 하단바 숨기기
  useEffect(() => {
    setHideTabBar(showCreateFolderModal);
    return () => {
      setHideTabBar(false);
    };
  }, [showCreateFolderModal, setHideTabBar]);
  
  const activeSubscription = getEffectiveSubscription(subscriptions);
  
  // Filter out "All" folder (isDefault: true)
  const filteredFolders = folders.filter((folder) => !folder.isDefault);
  
  // 필터링 및 정렬된 일기 목록
  const filteredAndSortedDiaries = useMemo(() => {
    let result = [...diaries];
    
    // 타입 필터링
    if (typeFilter !== 'all') {
      result = result.filter((diary) => diary.type === typeFilter);
    }
    
    // 날짜순 정렬
    result.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });
    
    return result;
  }, [diaries, typeFilter, sortOrder]);

  // 날짜별로 그룹화
  const diariesByDate = useMemo(() => {
    const grouped: Record<string, typeof filteredAndSortedDiaries> = {};
    filteredAndSortedDiaries.forEach((diary) => {
      const dateKey = format(new Date(diary.date), 'yyyy-MM-dd');
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(diary);
    });
    return grouped;
  }, [filteredAndSortedDiaries]);

  // 기본은 전체(undefined), 폴더 로드 시에도 전체 유지

  const handleAddFolder = () => {
    if (!activeSubscription && folders) {
      const nonDefaultCount = folders.filter((f: any) => !f.isDefault).length;
      if (nonDefaultCount >= 2) {
        setShowFolderLimitModal(true);
        return;
      }
    }
    setShowCreateFolderModal(true);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCoverImage(file);
    const url = URL.createObjectURL(file);
    setCoverImagePreview(url);
  };

  const removeImage = () => {
    if (coverImagePreview) {
      URL.revokeObjectURL(coverImagePreview);
    }
    setCoverImage(null);
    setCoverImagePreview(null);
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      alert(t('diary.folderNameRequired'));
      return;
    }

    try {
      setIsCreating(true);

      let coverImageUrl: string | undefined;
      if (coverImage) {
        try {
          coverImageUrl = await uploadImage.mutateAsync(coverImage);
        } catch (error) {
          console.error('Failed to upload cover image:', error);
          setUploadErrorToast(true);
          setIsCreating(false);
          return;
        }
      }

      const folderData: { name: string; coverImageUrl?: string } = {
        name: folderName.trim(),
      };
      if (coverImageUrl) {
        folderData.coverImageUrl = coverImageUrl;
      }
      
      await createFolder.mutateAsync(folderData);

      // Clean up preview URL
      if (coverImagePreview) {
        URL.revokeObjectURL(coverImagePreview);
      }

      // Reset form
      setFolderName('');
      setCoverImage(null);
      setCoverImagePreview(null);
      setShowCreateFolderModal(false);

      // Show toast
      const toastId = Date.now().toString();
      setToastMessages((prev) => [...prev, { id: toastId, message: t('diary.folderCreated') }]);
      setTimeout(() => {
        setToastMessages((prev) => prev.filter((t) => t.id !== toastId));
      }, 3000);
    } catch (error: any) {
      console.error('Failed to create folder:', error);
      const msg = error?.message || '';
      if (msg.includes('2 folders') || msg.includes('FOLDER_LIMIT')) {
        setShowFolderLimitModal(true);
      } else {
        alert(t('diary.folderCreateFailed'));
      }
      setShowCreateFolderModal(false);
    } finally {
      setIsCreating(false);
    }
  };



  const handleFolderClick = (folderId: string | undefined, e?: React.MouseEvent) => {
    setSelectedFolderId(folderId);
    // 모바일: 폴더명 클릭 시 편집 버튼 표시
    if (folderId && e) {
      setHoveredFolderId(folderId);
      // 일정 시간 후 자동으로 숨김 (선택적)
      setTimeout(() => {
        setHoveredFolderId((prev) => prev === folderId ? null : prev);
      }, 3000);
    }
  };

  const handleFolderNameClick = (folder: { id: string; name: string }) => {
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
  };

  const handleFolderNameSave = async (folderId: string) => {
    if (!editingFolderName.trim()) {
      alert(t('diary.folderNameRequired'));
      return;
    }
    
    try {
      await updateFolder.mutateAsync({
        id: folderId,
        name: editingFolderName.trim(),
      });
      setEditingFolderId(null);
      setEditingFolderName('');
      const toastId = Date.now().toString();
      setToastMessages((prev) => [...prev, { id: toastId, message: t('diary.folderRenamed') }]);
      setTimeout(() => {
        setToastMessages((prev) => prev.filter((t) => t.id !== toastId));
      }, 3000);
    } catch (error) {
      console.error('Failed to update folder:', error);
      alert(t('diary.folderRenameFailed'));
    }
  };

  const handleFolderNameCancel = () => {
    setEditingFolderId(null);
    setEditingFolderName('');
  };

  const handleFolderDeleteClick = (folder: { id: string; name: string }) => {
    setFolderToDelete(folder);
    setShowDeleteModal(true);
    setEditingFolderId(null); // 편집 모드 종료
  };

  const handleFolderDeleteConfirm = async () => {
    if (!folderToDelete) return;
    
    try {
      await deleteFolder.mutateAsync(folderToDelete.id);
      setShowDeleteModal(false);
      setFolderToDelete(null);
      
      // 삭제된 폴더가 현재 선택된 폴더인 경우 전체로 변경
      if (selectedFolderId === folderToDelete.id) {
        setSelectedFolderId(undefined);
      }
    } catch (error) {
      console.error('Failed to delete folder:', error);
      alert(t('diary.folderDeleteFailed'));
    }
  };

  return (
    <div 
      className="min-h-screen bg-white pb-20"
      onClick={(e) => {
        // 편집 모드일 때 바깥 영역 클릭 시 수정 취소
        if (editingFolderId && !(e.target as HTMLElement).closest('[data-folder-id]')) {
          handleFolderNameCancel();
        }
      }}
    >
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-white" style={{ paddingTop: 'max(4px, env(safe-area-inset-top, 4px))' }}>
          <div className="flex items-center justify-between px-4 pt-1 pb-0">
            <img
              src={theme === 'dark' ? '/dark.logo.png' : '/teum.home.png'}
              alt="teum logo"
              className="h-8 w-auto object-contain flex-shrink-0 home-logo"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="flex items-center gap-2 flex-shrink-0">
              {activeSubscription ? (
                <Button
                  variant="outline"
                  className="bg-gray-100 text-gray-700 border-0 rounded-full px-4 py-1.5 h-auto cursor-default text-xs"
                  disabled
                >
                  {t('my.subscribing')}
                </Button>
              ) : (
                <Link to="/payment">
                  <Button
                    variant="outline"
                    className="bg-gray-100 text-gray-700 hover:bg-gray-200 border-0 rounded-full px-4 py-1.5 h-auto text-xs"
                  >
                    {t('payment.subscribe')}
                  </Button>
                </Link>
              )}
              <ProfileButton />
            </div>
          </div>
          <div className="flex items-center justify-between px-4 pb-1">
            <span className="home-tagline font-bold leading-snug whitespace-nowrap text-[clamp(0.65rem,2.8vw,0.875rem)]" style={{ color: '#4A2C1A' }}>{t('home.tagline')}</span>
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowFilterMenu(!showFilterMenu)}
                className="flex items-center gap-1 px-3 py-1 text-sm text-gray-700 hover:text-[#4A2C1A] transition-colors rounded-lg hover:bg-gray-50"
              >
                <Filter className="w-4 h-4" />
                <span>{t('diary.filter')}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showFilterMenu ? 'rotate-180' : ''}`} />
              </button>
                {showFilterMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowFilterMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20 py-2">
                      <div className="px-3 py-2 border-b border-gray-100">
                        <p className="text-xs font-medium text-gray-500 mb-2">{t('diary.sort')}</p>
                        <button
                          onClick={() => { setSortOrder('newest'); setShowFilterMenu(false); }}
                          className={`w-full text-left px-2 py-1.5 text-sm rounded ${sortOrder === 'newest' ? 'bg-[#4A2C1A] text-white' : 'text-gray-700 hover:bg-gray-50'}`}
                        >
                          {t('diary.newest')}
                        </button>
                        <button
                          onClick={() => { setSortOrder('oldest'); setShowFilterMenu(false); }}
                          className={`w-full text-left px-2 py-1.5 text-sm rounded mt-1 ${sortOrder === 'oldest' ? 'bg-[#4A2C1A] text-white' : 'text-gray-700 hover:bg-gray-50'}`}
                        >
                          {t('diary.oldest')}
                        </button>
                      </div>
                      <div className="px-3 py-2">
                        <p className="text-xs font-medium text-gray-500 mb-2">{t('diary.typeFilter')}</p>
                        <button
                          onClick={() => { setTypeFilter('all'); setShowFilterMenu(false); }}
                          className={`w-full text-left px-2 py-1.5 text-sm rounded ${typeFilter === 'all' ? 'bg-[#4A2C1A] text-white' : 'text-gray-700 hover:bg-gray-50'}`}
                        >
                          {t('diary.all')}
                        </button>
                        <button
                          onClick={() => { setTypeFilter('free_form'); setShowFilterMenu(false); }}
                          className={`w-full text-left px-2 py-1.5 text-sm rounded mt-1 ${typeFilter === 'free_form' ? 'bg-[#4A2C1A] text-white' : 'text-gray-700 hover:bg-gray-50'}`}
                        >
                          {t('diary.freeForm')}
                        </button>
                        <button
                          onClick={() => { setTypeFilter('question_based'); setShowFilterMenu(false); }}
                          className={`w-full text-left px-2 py-1.5 text-sm rounded mt-1 ${typeFilter === 'question_based' ? 'bg-[#4A2C1A] text-white' : 'text-gray-700 hover:bg-gray-50'}`}
                        >
                          {t('diary.questionBased')}
                        </button>
                      </div>
                    </div>
                  </>
                )}
            </div>
          </div>
        </div>

        {/* Folder Tabs - 전체 + 폴더 목록 */}
        <div className="flex items-center gap-2 px-4 py-3 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => handleFolderClick(undefined)}
            className="relative flex-shrink-0 h-7 flex items-center"
          >
            <span className={`text-sm font-medium ${
              selectedFolderId === undefined ? 'text-[#4A2C1A]' : 'text-gray-600'
            }`}>
              {t('diary.all')}
            </span>
            {selectedFolderId === undefined && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4A2C1A]"></span>
            )}
          </button>
          {!foldersLoading && filteredFolders.map((folder) => (
            <div
              key={folder.id}
              data-folder-id={folder.id}
              className="relative flex-shrink-0 max-w-[120px] group h-7 flex items-center"
            >
              {editingFolderId === folder.id ? (
                // 편집 모드
                <div 
                  className="flex items-center gap-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="text"
                    value={editingFolderName}
                    onChange={(e) => setEditingFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleFolderNameSave(folder.id);
                      } else if (e.key === 'Escape') {
                        handleFolderNameCancel();
                      }
                    }}
                    autoFocus
                    className="text-sm font-medium px-1 py-0.5 border border-[#4A2C1A] rounded focus:outline-none focus:ring-1 focus:ring-[#4A2C1A] max-w-[80px]"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFolderNameSave(folder.id);
                    }}
                    className="text-[#4A2C1A] hover:text-[#3A2010] min-w-[32px] min-h-[32px] flex items-center justify-center"
                  >
                    ✓
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFolderDeleteClick(folder);
                    }}
                    className="text-red-600 hover:text-red-700 min-w-[32px] min-h-[32px] flex items-center justify-center"
                    title={t('diary.deleteFolder')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                // 일반 모드
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => handleFolderClick(folder.id, e)}
                    onMouseEnter={() => setHoveredFolderId(folder.id)}
                    onMouseLeave={() => setHoveredFolderId(null)}
                    className="relative"
                    title={folder.name}
                  >
                    <span className={`text-sm font-medium block truncate ${
                      selectedFolderId === folder.id ? 'text-[#4A2C1A]' : 'text-gray-600'
                    }`}>
                      {folder.name}
                    </span>
                    {selectedFolderId === folder.id && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4A2C1A]"></span>
                    )}
                  </button>
                  {(hoveredFolderId === folder.id || editingFolderId === folder.id) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFolderNameClick(folder);
                      }}
                      onMouseEnter={() => setHoveredFolderId(folder.id)}
                      onMouseLeave={() => setHoveredFolderId(null)}
                      className="text-gray-500 hover:text-[#4A2C1A] p-0.5 flex-shrink-0 transition-colors"
                      title={t('my.profileEdit')}
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
              
            </div>
          ))}
          
          <button
            onClick={handleAddFolder}
            className="text-gray-700 hover:text-[#4A2C1A] transition-colors flex-shrink-0"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Music Creation Banner - paid users with 7+ diaries */}
        {activeSubscription && diaryCount >= 7 && (
          <div className="px-4 pb-2">
            <button
              onClick={() => navigate('/music/create')}
              className="w-full flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200"
            >
              <div className="w-10 h-10 bg-[#f5ede4] rounded-full flex items-center justify-center flex-shrink-0">
                <Music className="w-5 h-5 text-[#4A2C1A]" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-[#4A2C1A]">teum</p>
                <p className="text-xs text-gray-500">{t('home.musicReady')}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
            </button>
          </div>
        )}

        {/* Main Content */}
        {diariesLoading ? (
          <div className="text-center py-12 text-muted-foreground">{t('common.loading')}</div>
        ) : diaries.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 space-y-6">
            {/* Empty State Illustration */}
            <img
              src="/non_diary.png"
              alt="No diary"
              className="w-48 h-auto object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            
            {/* Messages */}
            <div className="text-center space-y-2">
              <h2 className="text-lg font-semibold text-[#4A2C1A]">
                {t('diary.noDiaries')}
              </h2>
              <p className="text-sm text-[#4A2C1A]">
                {t('diary.startWriting')}
              </p>
              <p className="text-sm text-[#4A2C1A]">
                {t('diary.musicFromDiary')}
              </p>
            </div>

            {/* Learn More Link - 캘린더 탭으로 이동 */}
            <Link
              to="/calendar"
              className="text-sm text-[#4A2C1A] underline underline-offset-2"
            >
              {t('common.learnMore')}
            </Link>
          </div>
        ) : filteredAndSortedDiaries.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 space-y-4">
            <p className="text-sm text-gray-500">
              {t('diary.noFilterResults')}
            </p>
            <button
              onClick={() => {
                setTypeFilter('all');
                setSortOrder('newest');
              }}
              className="text-sm text-[#4A2C1A] underline underline-offset-2"
            >
              {t('diary.resetFilter')}
            </button>
          </div>
        ) : (
          <div className="px-4 py-6 space-y-6">
            {Object.entries(diariesByDate)
              .sort(([dateA], [dateB]) => {
                return sortOrder === 'newest' 
                  ? new Date(dateB).getTime() - new Date(dateA).getTime()
                  : new Date(dateA).getTime() - new Date(dateB).getTime();
              })
              .map(([dateKey, dateDiaries], groupIndex) => {
                const date = new Date(dateKey);
                const dateLabel = format(date, 'PPP (E)', { locale: getDateLocale() });
                
                return (
                  <div
                    key={dateKey}
                    className="space-y-3 animate-slide-up"
                    style={{ animationDelay: `${groupIndex * 100}ms` }}
                  >
                    {/* 날짜 헤더 */}
                    <h3 className="text-sm font-medium text-gray-700 text-center">{dateLabel}</h3>
                    
                    {/* 일기 목록 */}
                    {(() => {
                      const getDiaryTitle = (d: typeof dateDiaries[0]) => {
                        if (d.type === 'question_based' && d.answers?.length) {
                          return d.answers[0].question?.question?.trim() || t('diary.noTitle');
                        }
                        return d.title?.trim() || t('diary.noTitle');
                      };

                      const getDiaryPreview = (d: typeof dateDiaries[0]) => {
                        if (d.type === 'question_based' && d.answers?.length) {
                          const first = d.answers[0].answer?.trim();
                          if (first) {
                            const tmp = document.createElement('div');
                            tmp.innerHTML = first;
                            return (tmp.textContent || tmp.innerText || '').trim();
                          }
                          return '';
                        }
                        if (d.content?.trim()) return stripHTML(d.content).trim();
                        return '';
                      };

                      return (
                        <div className="space-y-3">
                          {dateDiaries.map((diary, diaryIndex) => {
                            const diaryTitle = getDiaryTitle(diary);
                            const diaryPreview = getDiaryPreview(diary);
                            const hasImage = diary.images && diary.images.length > 0;

                            return (
                              <Link
                                key={diary.id}
                                to={`/diaries/${diary.id}`}
                                className="block bg-white rounded-xl overflow-hidden border border-[#4A2C1A]/20 shadow-sm hover:shadow-md hover:border-[#4A2C1A]/40 transition-all duration-200 animate-slide-up"
                                style={{ animationDelay: `${groupIndex * 100 + diaryIndex * 80}ms` }}
                              >
                                {hasImage && (
                                  <div className="w-full h-40 overflow-hidden">
                                    <StorageImage
                                      url={diary.images![0].imageUrl}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                )}
                                <div className="px-4 py-3">
                                  <p className="text-sm font-semibold text-[#4A2C1A] truncate">{diaryTitle}</p>
                                  {diaryPreview && (
                                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{diaryPreview}</p>
                                  )}
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            {hasNextPage && (
              <div className="flex justify-center py-4">
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="px-6 py-2 text-sm text-[#4A2C1A] bg-gray-100 rounded-full hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  {isFetchingNextPage ? t('common.loading') : t('common.loadMore')}
                </button>
              </div>
            )}
            <div ref={scrollSentinelRef} className="h-1" />
          </div>
        )}
      </div>


      {/* 폴더 삭제 확인 모달 */}
      {showDeleteModal && folderToDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center animate-overlay-fade"
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl animate-modal-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center space-y-4">
              <h2 className="text-lg font-semibold text-[#4A2C1A]">
                {t('diary.deleteFolder')}
              </h2>
              <p className="text-sm text-gray-700">
                <span className="font-medium">"{folderToDelete.name}"</span> {t('diary.deleteFolderConfirm')}
              </p>
              <p className="text-sm text-red-600 font-medium">
                ⚠️ {t('diary.deleteFolderWarning')}
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-3 px-4 rounded-lg text-[#4A2C1A] font-medium hover:bg-gray-100 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleFolderDeleteConfirm}
                disabled={deleteFolder.isPending}
                className="flex-1 py-3 px-4 rounded-full bg-[#4A2C1A] hover:bg-[#3A2010] text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteFolder.isPending ? t('common.deleting') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 폴더 제한 팝업 모달 */}
      {showFolderLimitModal && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center animate-overlay-fade" onClick={() => setShowFolderLimitModal(false)}>
          <div
            className="bg-white rounded-2xl w-[85%] max-w-sm mx-auto p-6 animate-modal-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="w-12 h-12 bg-[#f5ede4] rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-6 h-6 text-[#4A2C1A]" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{t('diary.folderLimitReached')}</h3>
              <p className="text-sm text-gray-500 whitespace-pre-line mb-6">{t('diary.folderLimitMessage')}</p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    setShowFolderLimitModal(false);
                    navigate('/settings/subscription');
                  }}
                  className="w-full py-3 bg-[#4A2C1A] text-white rounded-full font-medium hover:bg-[#4A2C1A] transition-colors"
                >
                  {t('diary.goToSubscribe')}
                </button>
                <button
                  onClick={() => setShowFolderLimitModal(false)}
                  className="w-full py-3 text-gray-500 rounded-full font-medium hover:bg-gray-100 transition-colors"
                >
                  {t('common.close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 폴더 생성 모달 */}
      {showCreateFolderModal && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center animate-overlay-fade" onClick={() => setShowCreateFolderModal(false)}>
          <div
            className="bg-white rounded-2xl w-full max-w-sm mx-4 max-h-[80vh] overflow-y-auto animate-modal-pop"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 드래그 핸들 */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300" aria-hidden />
            </div>

            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between z-10">
              <button
                onClick={() => {
                  setShowCreateFolderModal(false);
                  setFolderName('');
                  setCoverImage(null);
                  if (coverImagePreview) {
                    URL.revokeObjectURL(coverImagePreview);
                    setCoverImagePreview(null);
                  }
                }}
                className="p-2 -ml-2"
              >
                <ArrowLeft className="w-5 h-5 text-[#4A2C1A]" />
              </button>
              <h2 className="text-lg font-semibold text-[#4A2C1A]">{t('diary.newFolder')}</h2>
              <div className="w-10" /> {/* Spacer */}
            </div>

            {/* Form */}
            <div className="px-4 py-6 space-y-6">
              {/* Folder Photo */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#4A2C1A]">{t('diary.folderPhoto')}</label>
                <div className="relative">
                  {coverImagePreview ? (
                    <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200">
                      <img
                        src={coverImagePreview}
                        alt="Cover preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={removeImage}
                        className="absolute top-1 right-1 w-6 h-6 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="block w-24 h-24 rounded-lg border border-gray-300 bg-white flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors">
                      <Plus className="w-6 h-6 text-gray-400" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Folder Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#4A2C1A]">{t('diary.folderName')}</label>
                <div className="relative">
                  <input
                    type="text"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    placeholder={t('diary.folderName')}
                    maxLength={50}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A2C1A] text-[#4A2C1A]"
                  />
                  <span className="absolute bottom-2 right-3 text-xs text-gray-400">
                    {folderName.length}/50
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateFolderModal(false);
                    setFolderName('');
                    setCoverImage(null);
                    if (coverImagePreview) {
                      URL.revokeObjectURL(coverImagePreview);
                      setCoverImagePreview(null);
                    }
                  }}
                  className="flex-1 py-3 px-4 rounded-full text-[#4A2C1A] font-medium hover:bg-gray-50 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleCreateFolder}
                  disabled={!folderName.trim() || isCreating}
                  className={`flex-1 py-3 px-4 rounded-lg text-white font-medium transition-colors ${
                    folderName.trim() && !isCreating
                      ? 'bg-[#4A2C1A] hover:bg-[#3A2010]'
                      : 'bg-gray-300 cursor-not-allowed'
                  }`}
                >
                  {isCreating ? t('common.creating') : t('common.create')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 토스트 메시지 (여러 개 표시) - 하단바 위에 표시 */}
      <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-[55] flex flex-col gap-2">
        {toastMessages.map((toast) => (
          <div
            key={toast.id}
            className="bg-gray-700/90 text-white px-6 py-3 rounded-full shadow-xl max-w-sm mx-4 animate-slide-up whitespace-nowrap"
          >
            <p className="text-sm text-center">{toast.message}</p>
          </div>
        ))}
      </div>

      <Toast
        message={t('error.imageUploadFailed')}
        isVisible={uploadErrorToast}
        onClose={() => setUploadErrorToast(false)}
      />
    </div>
  );
}
