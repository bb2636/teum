import { apiRequest } from './api';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function downloadMusicFile(
  jobId: string,
  title?: string,
  audioUrl?: string | null
): Promise<void> {
  if (!audioUrl) return;
  const filename = `${(title || 'music').replace(/[^a-zA-Z0-9가-힣\s]/g, '').replace(/\s+/g, '_')}.mp3`;
  const isNative = !!(window as any).Capacitor?.isNativePlatform?.();

  if (isNative) {
    try {
      const tokenData = await apiRequest<{ data: { token: string } }>(`/music/jobs/${jobId}/download-token`, {
        method: 'POST',
      });
      const token = (tokenData as any)?.data?.token || (tokenData as any)?.token;
      if (!token) {
        alert('다운로드 토큰이 없습니다');
        return;
      }

      const downloadUrl = `${window.location.origin}/api/music/download/${token}/${encodeURIComponent(filename)}`;

      const res = await fetch(downloadUrl);
      if (!res.ok) {
        alert(`다운로드 실패 (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const base64Data = await blobToBase64(blob);

      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        await Filesystem.writeFile({
          path: `Download/${filename}`,
          data: base64Data,
          directory: Directory.ExternalStorage,
          recursive: true,
        });
        alert(`'${filename}' 다운로드 완료! Download 폴더에 저장되었습니다.`);
      } catch (fsErr: any) {
        try {
          const { Filesystem, Directory } = await import('@capacitor/filesystem');
          await Filesystem.writeFile({
            path: filename,
            data: base64Data,
            directory: Directory.Documents,
            recursive: true,
          });
          alert(`'${filename}' 다운로드 완료! Documents 폴더에 저장되었습니다.`);
        } catch (fsErr2: any) {
          alert(`파일 저장 실패: ${fsErr?.message || fsErr} / ${fsErr2?.message || fsErr2}`);
        }
      }
    } catch (err: any) {
      alert(`다운로드 오류: ${err?.message || String(err)}`);
    }
    return;
  }

  try {
    const response = await fetch(audioUrl);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 5000);
  } catch {
    window.open(audioUrl, '_blank');
  }
}
