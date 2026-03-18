import { useState, ImgHTMLAttributes } from 'react';
import { getStorageImageSrc } from '@/lib/api';

/** 스토리지 이미지. 404(서버 재시작 등) 시 깨진 아이콘 대신 placeholder 표시 */
export function StorageImage({
  url,
  alt = '',
  className,
  ...props
}: { url: string } & ImgHTMLAttributes<HTMLImageElement>) {
  const [failed, setFailed] = useState(false);

  if (!url) return null;
  if (failed) {
    return (
      <div
        className={className}
        role="img"
        aria-label={alt || '이미지'}
        style={{ background: '#f3f4f6', minHeight: 48 }}
      />
    );
  }

  return (
    <img
      src={getStorageImageSrc(url)}
      alt={alt}
      className={className}
      loading="eager"
      onError={() => setFailed(true)}
      {...props}
    />
  );
}
