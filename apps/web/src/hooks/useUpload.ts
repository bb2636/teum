import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1920;
const JPEG_QUALITY = 0.8;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    if (file.size <= MAX_FILE_SIZE && !file.type.includes('heic') && !file.type.includes('heif')) {
      resolve(file);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Image compression failed'));
            return;
          }

          const compressedFile = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, '.jpg'),
            { type: 'image/jpeg' }
          );
          resolve(compressedFile);
        },
        'image/jpeg',
        JPEG_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}

export function useUploadImage() {
  return useMutation({
    mutationFn: async (file: File) => {
      const compressed = await compressImage(file);

      const formData = new FormData();
      formData.append('image', compressed);

      const response = await apiRequest<{ data: { url: string } }>('/upload/image', {
        method: 'POST',
        body: formData,
        headers: {},
      });

      return response.data.url;
    },
  });
}
