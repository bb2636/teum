import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Filter, ChevronDown, Pencil, Trash2, X, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StorageImage } from '@/components/StorageImage';
import { useDiaries, useFolders } from '@/hooks/useDiaries';
import { useCreateFolder, useUpdateFolder, useDeleteFolder } from '@/hooks/useFolders';
import { useUploadImage } from '@/hooks/useUpload';
import { useSubscriptions } from '@/hooks/usePayment';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

/** HTML 태그를 제거하고 텍스트만 반환 */
function stripHTML(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

type SortOrder = 'newest' | 'oldest';
type DiaryTypeFilter = 'all' | 'free_form' | 'question_based';

export function HomePage() {
  const navigate = useNavigate();
  const { data: folders = [], isLoading: foldersLoading } = useFolders();
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(undefined);
  const { data: diaries = [], isLoading: diariesLoading } = useDiaries(selectedFolderId);
  const { data: subscriptions = [] } = useSubscriptions();
  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();
  const deleteFolder = useDeleteFolder();
  const uploadImage = useUploadImage();
  
  // 필터 및 정렬 상태
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [typeFilter, setTypeFilter] = useState<DiaryTypeFilter>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  
  // 폴더 편집 상태
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState<string>('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<{ id: string; name: string } | null>(null);
  
  // 토스트 메시지 상태 (여러 개 표시 가능)
  const [toastMessages, setToastMessages] = useState<Array<{ id: string; message: string }>>([]);
  
  // 일기 작성 타입 선택 모달
  const [showTypeModal, setShowTypeModal] = useState(false);
  
  // 폴더 생성 모달 상태
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  const activeSubscription = subscriptions.find((s) => s.status === 'active');
  
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
      alert('폴더 이름을 입력해주세요.');
      return;
    }

    try {
      setIsCreating(true);

      // Upload cover image if selected
      let coverImageUrl: string | undefined;
      if (coverImage) {
        try {
          coverImageUrl = await uploadImage.mutateAsync(coverImage);
        } catch (error) {
          console.error('Failed to upload cover image:', error);
          // Continue without cover image
        }
      }

      // Create folder
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
      setToastMessages((prev) => [...prev, { id: toastId, message: '폴더가 생성되었습니다.' }]);
      setTimeout(() => {
        setToastMessages((prev) => prev.filter((t) => t.id !== toastId));
      }, 3000);
    } catch (error) {
      console.error('Failed to create folder:', error);
      alert('폴더 생성에 실패했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleTypeSelect = (type: 'free_form' | 'question_based') => {
    setShowTypeModal(false);
    navigate(`/diaries/new?type=${type}`);
  };

  const handleFolderClick = (folderId: string | undefined) => {
    setSelectedFolderId(folderId);
  };

  const handleFolderNameClick = (folder: { id: string; name: string }) => {
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
  };

  const handleFolderNameSave = async (folderId: string) => {
    if (!editingFolderName.trim()) {
      alert('폴더 이름을 입력해주세요.');
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
      setToastMessages((prev) => [...prev, { id: toastId, message: '폴더이름이 수정되었습니다.' }]);
      setTimeout(() => {
        setToastMessages((prev) => prev.filter((t) => t.id !== toastId));
      }, 3000);
    } catch (error) {
      console.error('Failed to update folder:', error);
      alert('폴더 이름 변경에 실패했습니다.');
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
      alert('폴더 삭제에 실패했습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="max-w-md mx-auto">
        {/* Header - First Row */}
        <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-white">
          <img
            src="/home_logo.png"
            alt="teum logo"
            className="h-8 w-auto object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          {activeSubscription ? (
            <Button
              variant="outline"
              className="bg-gray-100 text-gray-700 border-0 rounded-lg px-4 py-2 h-auto cursor-default"
              disabled
            >
              구독중
            </Button>
          ) : (
            <Link to="/payment">
              <Button
                variant="outline"
                className="bg-gray-100 text-gray-700 hover:bg-gray-200 border-0 rounded-lg px-4 py-2 h-auto"
              >
                구독하기
              </Button>
            </Link>
          )}
        </div>

        {/* Header - Second Row */}
        <div className="sticky top-[52px] z-30 px-4 pb-3 flex items-center justify-between bg-white">
          <h1 className="text-xl font-semibold text-gray-800">일기</h1>
          
          {/* 필터 버튼 */}
          <div className="relative">
            <button
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 hover:text-[#4A2C1A] transition-colors rounded-lg hover:bg-gray-50"
            >
              <Filter className="w-4 h-4" />
              <span>필터</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilterMenu ? 'rotate-180' : ''}`} />
            </button>
            
            {/* 필터 메뉴 */}
            {showFilterMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowFilterMenu(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20 py-2">
                  {/* 정렬 옵션 */}
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-xs font-medium text-gray-500 mb-2">정렬</p>
                    <button
                      onClick={() => {
                        setSortOrder('newest');
                        setShowFilterMenu(false);
                      }}
                      className={`w-full text-left px-2 py-1.5 text-sm rounded ${
                        sortOrder === 'newest'
                          ? 'bg-[#4A2C1A] text-white'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      최신순
                    </button>
                    <button
                      onClick={() => {
                        setSortOrder('oldest');
                        setShowFilterMenu(false);
                      }}
                      className={`w-full text-left px-2 py-1.5 text-sm rounded mt-1 ${
                        sortOrder === 'oldest'
                          ? 'bg-[#4A2C1A] text-white'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      오래된순
                    </button>
                  </div>
                  
                  {/* 타입 필터 */}
                  <div className="px-3 py-2">
                    <p className="text-xs font-medium text-gray-500 mb-2">타입</p>
                    <button
                      onClick={() => {
                        setTypeFilter('all');
                        setShowFilterMenu(false);
                      }}
                      className={`w-full text-left px-2 py-1.5 text-sm rounded ${
                        typeFilter === 'all'
                          ? 'bg-[#4A2C1A] text-white'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      전체
                    </button>
                    <button
                      onClick={() => {
                        setTypeFilter('free_form');
                        setShowFilterMenu(false);
                      }}
                      className={`w-full text-left px-2 py-1.5 text-sm rounded mt-1 ${
                        typeFilter === 'free_form'
                          ? 'bg-[#4A2C1A] text-white'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      자유형식
                    </button>
                    <button
                      onClick={() => {
                        setTypeFilter('question_based');
                        setShowFilterMenu(false);
                      }}
                      className={`w-full text-left px-2 py-1.5 text-sm rounded mt-1 ${
                        typeFilter === 'question_based'
                          ? 'bg-[#4A2C1A] text-white'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      질문기록
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Folder Tabs - 전체 + 폴더 목록 */}
        <div className="flex items-center gap-4 px-4 py-3 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => handleFolderClick(undefined)}
            className="relative pb-1 flex-shrink-0"
          >
            <span className={`text-sm font-medium ${
              selectedFolderId === undefined ? 'text-[#4A2C1A]' : 'text-gray-600'
            }`}>
              전체
            </span>
            {selectedFolderId === undefined && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4A2C1A]"></span>
            )}
          </button>
          {!foldersLoading && filteredFolders.map((folder) => (
            <div
              key={folder.id}
              data-folder-id={folder.id}
              className="relative pb-1 flex-shrink-0 max-w-[120px] group"
            >
              {editingFolderId === folder.id ? (
                // 편집 모드
                <div className="flex items-center gap-1">
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
                    className="text-[#4A2C1A] hover:text-[#5A3C2A]"
                  >
                    ✓
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFolderNameCancel();
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFolderDeleteClick(folder);
                    }}
                    className="text-red-600 hover:text-red-700 p-0.5"
                    title="폴더 삭제"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                // 일반 모드
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleFolderClick(folder.id)}
                    className="relative flex-1"
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
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFolderNameClick(folder);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-[#4A2C1A] p-0.5"
                    title="폴더 편집"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
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

        {/* Main Content */}
        {diariesLoading ? (
          <div className="text-center py-12 text-muted-foreground">로딩 중...</div>
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
                아직 작성된 일기가 없어요
              </h2>
              <p className="text-sm text-[#4A2C1A]">
                첫 일기를 작성해보세요
              </p>
              <p className="text-sm text-[#4A2C1A]">
                기록이 쌓이면 음악을 만들 수 있어요
              </p>
            </div>

            {/* Learn More Link - 캘린더 탭으로 이동 */}
            <Link
              to="/calendar"
              className="text-sm text-[#4A2C1A] underline underline-offset-2"
            >
              자세히보기
            </Link>
          </div>
        ) : filteredAndSortedDiaries.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 space-y-4">
            <p className="text-sm text-gray-500">
              선택한 필터 조건에 맞는 일기가 없습니다.
            </p>
            <button
              onClick={() => {
                setTypeFilter('all');
                setSortOrder('newest');
              }}
              className="text-sm text-[#4A2C1A] underline underline-offset-2"
            >
              필터 초기화
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
              .map(([dateKey, dateDiaries]) => {
                const date = new Date(dateKey);
                const dateLabel = format(date, 'M월 d일 (E)', { locale: ko });
                
                return (
                  <div key={dateKey} className="space-y-3">
                    {/* 날짜 헤더 */}
                    <h3 className="text-sm font-medium text-gray-700 px-1">{dateLabel}</h3>
                    
                    {/* 해당 날짜의 일기 목록 */}
                    <div className="space-y-3">
                      {dateDiaries.map((diary) => {
                        // 일기 첫 줄 추출
                        const getFirstLine = (diary: typeof dateDiaries[0]) => {
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
                            const textContent = stripHTML(diary.content);
                            return textContent.trim().split('\n')[0].trim();
                          }
                          return '';
                        };
                        
                        const firstLine = getFirstLine(diary);
                        const hasImage = diary.images && diary.images.length > 0;
                        
                        return (
                          <Link
                            key={diary.id}
                            to={`/diaries/${diary.id}`}
                            className="block bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                          >
                            {hasImage && diary.images && diary.images.length > 0 ? (
                              <div className="relative">
                                <StorageImage
                                  url={diary.images[0].imageUrl}
                                  className="w-full h-48 object-cover"
                                />
                                {firstLine && (
                                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white p-3">
                                    <p className="text-sm font-medium line-clamp-1">{firstLine}</p>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="p-4">
                                {diary.type === 'question_based' ? (
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                                      <span className="text-2xl">📝</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      {firstLine ? (
                                        <p className="text-sm text-gray-700 line-clamp-2">{firstLine}</p>
                                      ) : (
                                        <p className="text-sm text-gray-400">이 곳에 질문이 들어갑니다.</p>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-700 line-clamp-2">
                                    {firstLine || '이 곳에 제목이 들어갑니다.'}
                                  </p>
                                )}
                              </div>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>


      {/* 폴더 삭제 확인 모달 */}
      {showDeleteModal && folderToDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center space-y-4">
              <h2 className="text-lg font-semibold text-[#4A2C1A]">
                폴더 삭제
              </h2>
              <p className="text-sm text-gray-700">
                <span className="font-medium">"{folderToDelete.name}"</span> 폴더를 삭제하시겠습니까?
              </p>
              <p className="text-sm text-red-600 font-medium">
                ⚠️ 해당 폴더 내 작성된 일기 전부가 삭제됩니다.
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-3 px-4 rounded-lg text-[#4A2C1A] font-medium hover:bg-gray-100 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleFolderDeleteConfirm}
                disabled={deleteFolder.isPending}
                className="flex-1 py-3 px-4 rounded-lg bg-[#665146] hover:bg-[#5A453A] text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteFolder.isPending ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 일기 작성 타입 선택 모달 */}
      {showTypeModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setShowTypeModal(false)}>
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-[#4A2C1A] mb-2">
              오늘은 어떤 방식으로 남기시겠습니까?
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              빠르게 쓰거나, 질문에 따라 차근히 정리할 수 있습니다.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => handleTypeSelect('free_form')}
                className="w-full py-4 px-4 bg-gray-100 hover:bg-gray-200 rounded-xl text-[#4A2C1A] font-medium transition-colors"
              >
                자유작성
              </button>
              <button
                onClick={() => handleTypeSelect('question_based')}
                className="w-full py-4 px-4 bg-gray-100 hover:bg-gray-200 rounded-xl text-[#4A2C1A] font-medium transition-colors"
              >
                질문기록
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 폴더 생성 모달 */}
      {showCreateFolderModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end" onClick={() => setShowCreateFolderModal(false)}>
          <div
            className="bg-white rounded-t-3xl w-full max-w-md mx-auto max-h-[90vh] overflow-y-auto animate-slide-up"
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
              <h2 className="text-lg font-semibold text-[#4A2C1A]">새로운 폴더</h2>
              <div className="w-10" /> {/* Spacer */}
            </div>

            {/* Form */}
            <div className="px-4 py-6 space-y-6">
              {/* Folder Photo */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#4A2C1A]">폴더 사진</label>
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
                <label className="text-sm font-medium text-[#4A2C1A]">폴더 이름</label>
                <div className="relative">
                  <input
                    type="text"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    placeholder="폴더 이름"
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
                  className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-[#4A2C1A] font-medium hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleCreateFolder}
                  disabled={!folderName.trim() || isCreating}
                  className={`flex-1 py-3 px-4 rounded-lg text-white font-medium transition-colors ${
                    folderName.trim() && !isCreating
                      ? 'bg-[#4A2C1A] hover:bg-[#5A3C2A]'
                      : 'bg-gray-300 cursor-not-allowed'
                  }`}
                >
                  {isCreating ? '만드는 중...' : '만들기'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 토스트 메시지 (여러 개 표시) */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 flex flex-col gap-2">
        {toastMessages.map((toast) => (
          <div
            key={toast.id}
            className="bg-gray-700/90 text-white px-6 py-3 rounded-lg shadow-xl max-w-sm mx-4 animate-slide-up whitespace-nowrap"
          >
            <p className="text-sm text-center">{toast.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
