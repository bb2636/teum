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

      const serverPath = `teum.replit.app/api/music/download/${token}/${encodeURIComponent(filename)}`;
      const fallbackUrl = `https://${serverPath}`;
      const intentUrl = `intent://${serverPath}#Intent;scheme=https;action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;

      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = intentUrl;
      document.body.appendChild(iframe);
      setTimeout(() => document.body.removeChild(iframe), 3000);
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
