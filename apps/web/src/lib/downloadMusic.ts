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
    let blob: Blob | null = null;

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

    if (token) {
      try {
        const audioRes = await fetch(`/api/music/download/${token}`);
        if (audioRes.ok) {
          blob = await audioRes.blob();
        }
      } catch {}
    }

    if (blob) {
      // 방법1: navigator.share (File 객체로 파일명 지정)
      try {
        const file = new File([blob], filename, { type: 'audio/mpeg' });
        const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
        alert(`방법1 share: canShare=${canShare}`);
        if (canShare) {
          await navigator.share({ files: [file] });
          alert('방법1 성공: share 완료');
          return;
        }
      } catch (e: any) {
        alert(`방법1 실패: ${e?.message || e}`);
      }

      // 방법2: <a> 태그 + 서버 URL (Content-Disposition 활용, 새 토큰)
      try {
        const controller2 = new AbortController();
        const timer2 = setTimeout(() => controller2.abort(), 5000);
        const tokenRes2 = await fetch(`/api/music/jobs/${jobId}/download-token`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          signal: controller2.signal,
        });
        clearTimeout(timer2);
        if (tokenRes2.ok) {
          const tokenData2 = await tokenRes2.json();
          const token2 = tokenData2?.data?.token;
          if (token2) {
            const link = document.createElement('a');
            link.href = `/api/music/download/${token2}`;
            link.download = filename;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            alert('방법2 실행: <a> 서버URL 클릭. 다운로드 됐으면 여기서 중단. 안 됐으면 방법3 진행?');
          }
        }
      } catch (e: any) {
        alert(`방법2 실패: ${e?.message || e}`);
      }

      // 방법3: blob URL (다운로드는 되지만 파일명 UUID)
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      alert('방법3 실행: blob 다운로드 (파일명 UUID일 수 있음)');
      return;
    }
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
