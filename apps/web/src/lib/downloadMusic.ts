import { apiRequest } from '@/lib/api';

export async function downloadMusicFile(
  jobId: string,
  title?: string,
  audioUrl?: string | null
): Promise<void> {
  if (!audioUrl) return;
  const filename = `${(title || 'music').replace(/[^a-zA-Z0-9가-힣\s]/g, '').replace(/\s+/g, '_')}.mp3`;

  let isNative = false;
  try {
    const { Capacitor } = await import('@capacitor/core');
    isNative = Capacitor.isNativePlatform();
  } catch {}

  if (isNative) {
    try {
      const result: any = await apiRequest(`/music/jobs/${jobId}/download-token`, {
        method: 'POST',
      });
      const token = result?.data?.token;
      if (token) {
        const apiBase = import.meta.env.VITE_API_URL || '/api';
        const downloadUrl = `${apiBase}/music/download/${token}`;
        window.open(downloadUrl, '_system');
        return;
      }
    } catch (error) {
      console.error('Token download failed:', error);
    }
    window.open(audioUrl, '_blank');
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
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Download failed:', error);
    window.open(audioUrl, '_blank');
  }
}
