import { useRef } from 'react';
import { Image, Trash2 } from 'lucide-react';

interface ProfileImagePickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelectImage: (file: File) => void;
  onDeleteImage: () => void;
  hasImage: boolean;
}

export function ProfileImagePickerModal({
  open,
  onClose,
  onSelectImage,
  onDeleteImage,
  hasImage,
}: ProfileImagePickerModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleGalleryClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSelectImage(file);
    }
    e.target.value = '';
  };

  const handleDelete = () => {
    onDeleteImage();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 animate-overlay-fade" />
      <div
        className="relative w-full max-w-md bg-white rounded-t-2xl animate-modal-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pt-6 pb-4 space-y-3">
          <button
            type="button"
            onClick={handleGalleryClick}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-[#F5F0EB] hover:bg-[#EDE5DD] transition-colors"
          >
            <Image className="w-5 h-5 text-[#4A2C1A]" />
            <span className="text-[#4A2C1A] font-medium">갤러리에서 선택하기</span>
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={!hasImage}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-colors ${
              hasImage
                ? 'bg-[#F5F0EB] hover:bg-[#EDE5DD]'
                : 'bg-gray-100 opacity-50 cursor-not-allowed'
            }`}
          >
            <Trash2 className="w-5 h-5 text-[#4A2C1A]" />
            <span className="text-[#4A2C1A] font-medium">삭제하기</span>
          </button>
        </div>

        <div className="px-4 pb-6">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3.5 rounded-xl bg-[#4A2C1A] hover:bg-[#3A2010] text-white font-semibold transition-colors"
          >
            닫기
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
}
