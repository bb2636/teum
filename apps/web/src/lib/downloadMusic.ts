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
      const apiBase = '/api';
      const tokenRes = await fetch(`${apiBase}/music/jobs/${jobId}/download-token`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        const token = tokenData?.data?.token;
        if (token) {
          window.open(`${apiBase}/music/download/${token}`, '_blank');
          return;
        }
      }
    } catch {}
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
