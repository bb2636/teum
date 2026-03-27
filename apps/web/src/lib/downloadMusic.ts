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
      const tokenRes = await fetch(`/api/music/jobs/${jobId}/download-token`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!tokenRes.ok) {
        const body = await tokenRes.text().catch(() => '');
        alert(`다운로드 준비 실패 (${tokenRes.status}: ${body.substring(0, 100)})`);
        return;
      }

      const tokenData = await tokenRes.json();
      const token = tokenData?.data?.token;
      if (!token) {
        alert('다운로드 토큰이 없습니다');
        return;
      }

      const downloadUrl = `${window.location.origin}/api/music/download/${token}/${encodeURIComponent(filename)}`;
      window.location.href = downloadUrl;
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
