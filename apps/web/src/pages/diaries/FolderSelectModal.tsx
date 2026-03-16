import { X, Plus } from 'lucide-react';
import { useFolders } from '@/hooks/useDiaries';
import { useDiaries } from '@/hooks/useDiaries';

interface FolderSelectModalProps {
  selectedFolderId?: string;
  onSelect: (folderId: string) => void;
  onClose: () => void;
  onCreateNew: () => void;
}

export function FolderSelectModal({
  selectedFolderId,
  onSelect,
  onClose,
  onCreateNew,
}: FolderSelectModalProps) {
  const { data: folders = [] } = useFolders();
  const { data: allDiaries = [] } = useDiaries();

  // Get diary count for each folder
  const getDiaryCount = (folderId: string) => {
    return allDiaries.filter((diary) => diary.folderId === folderId).length;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl w-full max-w-md mx-auto max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#4A2C1A]">새로운 폴더</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Folder Grid */}
        <div className="p-4">
          <div className="grid grid-cols-2 gap-4">
            {folders.map((folder) => {
              const diaryCount = getDiaryCount(folder.id);
              return (
                <button
                  key={folder.id}
                  onClick={() => onSelect(folder.id)}
                  className={`relative rounded-xl overflow-hidden shadow-sm transition-all ${
                    selectedFolderId === folder.id
                      ? 'ring-2 ring-[#4A2C1A]'
                      : 'hover:shadow-md'
                  }`}
                >
                  {folder.coverImageUrl ? (
                    <img
                      src={folder.coverImageUrl}
                      alt={folder.name}
                      className="w-full h-32 object-cover"
                    />
                  ) : (
                    <div className="w-full h-32 bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-400 text-sm">{folder.name}</span>
                    </div>
                  )}
                  <div className="p-3 bg-white">
                    <p className="text-sm font-medium text-[#4A2C1A] mb-1">
                      {folder.name}
                    </p>
                    <p className="text-xs text-gray-500">{diaryCount}개의 일기</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Create New Folder Button */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={onCreateNew}
            className="w-full py-4 px-4 bg-[#4A2C1A] hover:bg-[#5A3C2A] text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            새로운 폴더
          </button>
        </div>
      </div>
    </div>
  );
}
