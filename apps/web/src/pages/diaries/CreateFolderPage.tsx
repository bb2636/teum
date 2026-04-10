import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { useCreateFolder } from '@/hooks/useFolders';
import { useUploadImage } from '@/hooks/useUpload';
import { useT } from '@/hooks/useTranslation';

export function CreateFolderPage() {
  const navigate = useNavigate();
  const t = useT();
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
      alert(t('diary.folderNameRequired'));
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
      alert(t('diary.folderCreateFailed'));
    } finally {
      setIsCreating(false);
    }
  };

  const isFormValid = folderName.trim().length > 0;
  const [kbHeight, setKbHeight] = useState(0);
  const formContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handleResize = () => {
      const h = window.innerHeight - vv.height;
      setKbHeight(h > 50 ? h : 0);
    };
    vv.addEventListener('resize', handleResize);
    return () => vv.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (kbHeight > 0 && formContainerRef.current) {
      const input = formContainerRef.current.querySelector('input[type="text"]');
      if (input) {
        setTimeout(() => {
          input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    }
  }, [kbHeight]);

  return (
    <div className="fixed inset-0 bg-white">
      <div
        ref={formContainerRef}
        className="max-w-md mx-auto flex flex-col overflow-y-auto"
        style={{
          height: kbHeight > 0 ? `${window.innerHeight - kbHeight}px` : '100%',
          transition: 'height 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
          <button onClick={() => navigate(-1)} className="p-2">
            <ArrowLeft className="w-5 h-5 text-[#4A2C1A]" />
          </button>
          <h1 className="text-lg font-semibold text-[#4A2C1A]">{t('diary.newFolderTitle')}</h1>
          <div className="w-10" />
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col px-4 py-6 space-y-6 overflow-y-auto">
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
            <label className="text-sm font-medium text-[#4A2C1A]">{t('diary.folderNameLabel')}</label>
            <div className="relative">
              <input
                type="text"
                value={folderName}
                onChange={(e) => {
                  const val = e.target.value;
                  const koCount = (val.match(/[가-힣ㄱ-ㅎㅏ-ㅣ]/g) || []).length;
                  const enCount = val.length - koCount;
                  if (koCount <= 5 && enCount <= 10 && val.length <= 10) {
                    setFolderName(val);
                  }
                }}
                placeholder={t('diary.folderNameLabel')}
                maxLength={10}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A2C1A] text-[#4A2C1A]"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 mt-auto" style={{ paddingBottom: kbHeight > 0 ? '16px' : 'max(32px, calc(env(safe-area-inset-bottom, 0px) + 32px))' }}>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 py-3 px-4 rounded-full text-[#4A2C1A] font-medium hover:bg-gray-50 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={!isFormValid || isCreating}
              className={`flex-1 py-3 px-4 rounded-lg text-white font-medium transition-colors ${
                isFormValid && !isCreating
                  ? 'bg-[#4A2C1A] hover:bg-[#3A2010]'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              {isCreating ? t('common.creating') : t('common.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
