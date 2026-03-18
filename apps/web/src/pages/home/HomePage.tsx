import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StorageImage } from '@/components/StorageImage';
import { useDiaries, useFolders } from '@/hooks/useDiaries';
import { useCreateFolder } from '@/hooks/useFolders';
import { useSubscriptions } from '@/hooks/usePayment';

/** HTML 태그를 제거하고 텍스트만 반환 */
function stripHTML(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

export function HomePage() {
  const { data: folders = [], isLoading: foldersLoading } = useFolders();
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(undefined);
  const { data: diaries = [], isLoading: diariesLoading } = useDiaries(selectedFolderId);
  const { data: subscriptions = [] } = useSubscriptions();
  const createFolder = useCreateFolder();
  
  const activeSubscription = subscriptions.find((s) => s.status === 'active');
  
  // Filter out "All" folder (isDefault: true)
  const filteredFolders = folders.filter((folder) => !folder.isDefault);

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
        <div className="px-4 pb-3">
          <h1 className="text-xl font-semibold text-gray-800">일기</h1>
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
            <button
              key={folder.id}
              onClick={() => handleFolderClick(folder.id)}
              className="relative pb-1 flex-shrink-0 max-w-[120px]"
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
        ) : (
          <div className="px-4 py-6 space-y-3">
            {diaries.map((diary) => (
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
    </div>
  );
}
