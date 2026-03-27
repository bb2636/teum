export async function downloadMusicFile(
  jobId: string,
  title?: string,
  audioUrl?: string | null
): Promise<void> {
  if (!audioUrl) return;
  const filename = `${(title || 'music').replace(/[^a-zA-Z0-9가-힣\s]/g, '').replace(/\s+/g, '_')}.mp3`;
  const isNative = !!(window as any).Capacitor?.isNativePlatform?.();

  if (isNative) {
    let token: string | null = null;
    let debugInfo = '';
    try {
      const tokenRes = await fetch(`/api/music/jobs/${jobId}/download-token`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      debugInfo = `status=${tokenRes.status}`;
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        token = tokenData?.data?.token || null;
        if (!token) debugInfo += ' token=null';
      } else {
        const body = await tokenRes.text();
        debugInfo += ` body=${body.substring(0, 200)}`;
      }
    } catch (e: any) {
      debugInfo = `fetch error: ${e?.message}`;
    }

    if (!token) {
      alert(`토큰 발급 실패 (${debugInfo})`);
      return;
    }

    const downloadUrl = `${window.location.origin}/api/music/download/${token}/${encodeURIComponent(filename)}`;
    window.open(downloadUrl, '_system');
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
