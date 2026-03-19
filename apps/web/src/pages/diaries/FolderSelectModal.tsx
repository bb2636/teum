import { useState } from 'react';
import { X, Plus, ArrowLeft } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useFolders } from '@/hooks/useDiaries';
import { useDiaries } from '@/hooks/useDiaries';
import { useCreateFolder } from '@/hooks/useFolders';
import { useUploadImage } from '@/hooks/useUpload';
import { getStorageImageSrc } from '@/lib/api';

interface FolderSelectModalProps {
  selectedFolderId?: string;
  onSelect: (folderId: string) => void;
  onClose: () => void;
  onCreateNew?: () => void; // Optional for backward compatibility
}

export function FolderSelectModal({
  selectedFolderId,
  onSelect,
  onClose,
}: FolderSelectModalProps) {
  const queryClient = useQueryClient();
  const { data: folders = [] } = useFolders();
  const { data: allDiaries = [] } = useDiaries();
  const createFolder = useCreateFolder();
  const uploadImage = useUploadImage();
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // Show all folders including default folder
  const filteredFolders = folders;

  // Get diary count for each folder
  const getDiaryCount = (folderId: string) => {
    return allDiaries.filter((diary) => diary.folderId === folderId).length;
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
      // Only include coverImageUrl if it exists (don't send undefined)
      const folderData: { name: string; coverImageUrl?: string } = {
        name: folderName.trim(),
      };
      if (coverImageUrl) {
        folderData.coverImageUrl = coverImageUrl;
      }
      
      const newFolder = await createFolder.mutateAsync(folderData);

      // Clean up preview URL
      if (coverImagePreview) {
        URL.revokeObjectURL(coverImagePreview);
      }

      // Reset form
      setFolderName('');
      setCoverImage(null);
      setCoverImagePreview(null);
      setShowCreateForm(false);

      // Invalidate folders and diaries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['diaries'] });

      // Select the newly created folder
      onSelect(newFolder.id);
    } catch (error) {
      console.error('Failed to create folder:', error);
      alert('폴더 생성에 실패했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  if (showCreateForm) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-end" onClick={onClose}>
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
                setShowCreateForm(false);
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
                  setShowCreateForm(false);
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
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl w-full max-w-md mx-auto max-h-[80vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 드래그 핸들 */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" aria-hidden />
        </div>

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-[#4A2C1A]">폴더 선택</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Folder Slider */}
        <div className="p-4">
          <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
            {filteredFolders.map((folder) => {
              const diaryCount = getDiaryCount(folder.id);
              return (
                <button
                  key={folder.id}
                  onClick={() => onSelect(folder.id)}
                  className={`relative rounded-xl overflow-hidden shadow-sm transition-all flex-shrink-0 w-[140px] ${
                    selectedFolderId === folder.id
                      ? 'ring-2 ring-[#4A2C1A]'
                      : 'hover:shadow-md'
                  }`}
                  title={folder.name}
                >
                  {folder.coverImageUrl ? (
                    <img
                      src={getStorageImageSrc(folder.coverImageUrl)}
                      alt={folder.name}
                      className="w-full h-32 object-cover"
                    />
                  ) : (
                    <div className="w-full h-32 bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-400 text-sm text-center px-2 truncate w-full">
                        {folder.name}
                      </span>
                    </div>
                  )}
                  <div className="p-3 bg-white">
                    <p className="text-sm font-medium text-[#4A2C1A] mb-1 truncate" title={folder.name}>
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
            onClick={() => setShowCreateForm(true)}
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
