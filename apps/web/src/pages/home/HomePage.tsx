import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Filter, ChevronDown, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StorageImage } from '@/components/StorageImage';
import { useDiaries, useFolders } from '@/hooks/useDiaries';
import { useCreateFolder, useUpdateFolder, useDeleteFolder } from '@/hooks/useFolders';
import { useSubscriptions } from '@/hooks/usePayment';

/** HTML 태그를 제거하고 텍스트만 반환 */
function stripHTML(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

type SortOrder = 'newest' | 'oldest';
type DiaryTypeFilter = 'all' | 'free_form' | 'question_based';

export function HomePage() {
  const { data: folders = [], isLoading: foldersLoading } = useFolders();
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(undefined);
  const { data: diaries = [], isLoading: diariesLoading } = useDiaries(selectedFolderId);
  const { data: subscriptions = [] } = useSubscriptions();
  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();
  const deleteFolder = useDeleteFolder();
  
  // 필터 및 정렬 상태
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [typeFilter, setTypeFilter] = useState<DiaryTypeFilter>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  
  // 폴더 편집 상태
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState<string>('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<{ id: string; name: string } | null>(null);
  
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

  // 기본은 전체(undefined), 폴더 로드 시에도 전체 유지

  const handleAddFolder = async () => {
    const folderName = prompt('폴더 이름을 입력해주세요');
    if (folderName && folderName.trim()) {
      try {
        await createFolder.mutateAsync({
          name: folderName.trim(),
        });
      } catch (error) {
        console.error('Failed to create folder:', error);
        alert('폴더 생성에 실패했습니다.');
      }
    }
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
        <div className="flex items-center justify-between px-4 py-3 bg-white">
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
            <Link to="/payment?plan=월간&amount=4900">
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
        <div className="px-4 pb-3 flex items-center justify-between">
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
              
              {/* 편집 메뉴 (연필 아이콘 클릭 시) */}
              {editingFolderId === folder.id && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-20 min-w-[120px]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFolderDeleteClick(folder);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    삭제
                  </button>
                </div>
              )}
            </div>
          ))}
          
          <button
            onClick={handleAddFolder}
            className="text-gray-700 hover:text-[#4A2C1A] transition-colors flex-shrink-0"
            disabled={createFolder.isPending}
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
          <div className="px-4 py-6 space-y-3">
            {filteredAndSortedDiaries.map((diary) => (
              <Link
                key={diary.id}
                to={`/diaries/${diary.id}`}
                className="block bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow border border-gray-100"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(diary.date).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                      })}
                    </span>
                    {diary.type === 'question_based' && (
                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                        질문기록
                      </span>
                    )}
                  </div>
                  
                  {/* 질문기록 형식: 썸네일과 질문 제목들 표시 */}
                  {diary.type === 'question_based' && diary.answers && diary.answers.length > 0 ? (
                    <div className="flex gap-3">
                      {/* 썸네일 (있는 경우) */}
                      {diary.images && diary.images.length > 0 && (
                        <div className="flex-shrink-0">
                          <StorageImage
                            url={diary.images[0].imageUrl}
                            className="h-16 w-16 rounded object-cover"
                          />
                        </div>
                      )}
                      {/* 질문 제목들 */}
                      <div className="flex-1 min-w-0 space-y-1">
                        {diary.answers.map((answer, index) => (
                          <p
                            key={answer.id}
                            className="text-sm text-gray-700 truncate"
                            title={answer.question?.question || `질문 ${index + 1}`}
                          >
                            {answer.question?.question || `질문 ${index + 1}`}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* 자유형식: 기존 레이아웃 */}
                      {diary.images && diary.images.length > 0 && (
                        <div className="flex gap-1 overflow-x-auto">
                          {diary.images.slice(0, 3).map((img) => (
                            <StorageImage
                              key={img.id}
                              url={img.imageUrl}
                              className="h-16 w-16 flex-shrink-0 rounded object-cover"
                            />
                          ))}
                        </div>
                      )}
                      {diary.title && (
                        <h3 className="font-semibold text-[#4A2C1A]">{diary.title}</h3>
                      )}
                      {diary.content && (
                        <p className="text-sm text-gray-700 line-clamp-2">
                          {stripHTML(diary.content)}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <Link
        to="/diaries/new?type=free_form"
        className="fixed bottom-24 right-4 z-40"
      >
        <Button
          size="icon"
          className="w-14 h-14 rounded-full bg-[#4A2C1A] hover:bg-[#5A3C2A] text-white shadow-lg"
        >
          <Plus className="w-6 h-6" />
        </Button>
      </Link>

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
                className="flex-1 py-3 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteFolder.isPending ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
