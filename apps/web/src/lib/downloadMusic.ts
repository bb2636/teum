import { apiRequest } from './api';

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

      if (navigator.share) {
        try {
          await navigator.share({
            title: `${title || '음악'} 다운로드`,
            text: 'Chrome에서 열면 다운로드됩니다',
            url: downloadUrl,
          });
          return;
        } catch (shareErr: any) {
          if (shareErr?.name === 'AbortError') return;
        }
      }

      try {
        await navigator.clipboard.writeText(downloadUrl);
        alert('다운로드 링크가 복사되었습니다!\n\nChrome 브라우저를 열고 주소창에 붙여넣기 하면 다운로드가 시작됩니다.');
      } catch {
        prompt('아래 링크를 복사해서 Chrome 주소창에 붙여넣기 하세요:', downloadUrl);
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
