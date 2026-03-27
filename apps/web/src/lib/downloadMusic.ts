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
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const tokenRes = await fetch(`/api/music/jobs/${jobId}/download-token`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        token = tokenData?.data?.token || null;
      }
    } catch {}

    if (!token) {
      alert('토큰 발급 실패');
      return;
    }

    const pageUrl = `${window.location.origin}/music/download?token=${token}&name=${encodeURIComponent(filename)}`;
    alert(`공유할 URL: ${pageUrl}`);

    if (!navigator.share) {
      alert('navigator.share 미지원');
      return;
    }

    try {
      await navigator.share({
        title: `${title || 'music'} 다운로드`,
        url: pageUrl,
      });
      alert('공유 완료 (Chrome에서 다운로드 페이지가 열렸어야 합니다)');
    } catch (e: any) {
      alert(`공유 실패/취소: ${e?.name} - ${e?.message}`);
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
