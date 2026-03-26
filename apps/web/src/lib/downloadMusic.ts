const API_BASE = import.meta.env.VITE_API_URL || '/api';

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
      const tokenRes = await fetch(`${API_BASE}/music/jobs/${jobId}/download-token`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        const token = tokenData?.data?.token;
        if (token) {
          window.open(`${API_BASE}/music/download/${token}`, '_blank');
          return;
        }
      }
    } catch {}
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
  } catch {
    window.open(audioUrl, '_blank');
  }
}
