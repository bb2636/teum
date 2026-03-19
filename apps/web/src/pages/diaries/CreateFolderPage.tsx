import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { useCreateFolder } from '@/hooks/useFolders';
import { useUploadImage } from '@/hooks/useUpload';

export function CreateFolderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const createFolder = useCreateFolder();
  const uploadImage = useUploadImage();

  const [folderName, setFolderName] = useState('');
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
      await createFolder.mutateAsync({
        name: folderName.trim(),
        coverImageUrl,
      });

      // Clean up preview URL
      if (coverImagePreview) {
        URL.revokeObjectURL(coverImagePreview);
      }

      // Navigate back or to returnTo URL
      const returnTo = searchParams.get('returnTo');
      if (returnTo) {
        navigate(returnTo);
      } else {
        navigate(-1);
      }
    } catch (error) {
      console.error('Failed to create folder:', error);
      alert('폴더 생성에 실패했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  const isFormValid = folderName.trim().length > 0;

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="max-w-md mx-auto h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <button onClick={() => navigate(-1)} className="p-2">
            <ArrowLeft className="w-5 h-5 text-[#4A2C1A]" />
          </button>
          <h1 className="text-lg font-semibold text-[#4A2C1A]">새로운 폴더</h1>
          <div className="w-10" /> {/* Spacer */}
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col px-4 py-6 space-y-6">
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
          <div className="flex gap-3 pt-4 mt-auto">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-[#4A2C1A] font-medium hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!isFormValid || isCreating}
              className={`flex-1 py-3 px-4 rounded-lg text-white font-medium transition-colors ${
                isFormValid && !isCreating
                  ? 'bg-[#4A2C1A] hover:bg-[#5A3C2A]'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              {isCreating ? '만드는 중...' : '만들기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
