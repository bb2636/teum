export async function downloadMusicFile(
  jobId: string,
  title?: string,
  audioUrl?: string | null
): Promise<void> {
  if (!audioUrl) return;
  const filename = `${(title || 'music').replace(/[^a-zA-Z0-9가-힣\s]/g, '').replace(/\s+/g, '_')}.mp3`;

  try {
    alert('1단계: 토큰 요청 시작');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const tokenRes = await fetch(`/api/music/jobs/${jobId}/download-token`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    alert(`2단계: 토큰 응답 status=${tokenRes.status}`);
    if (tokenRes.ok) {
      const tokenData = await tokenRes.json();
      const token = tokenData?.data?.token;
      alert(`3단계: 토큰=${token ? '있음' : '없음'}`);
      if (token) {
        alert('4단계: 서버 프록시 fetch 시작 (시간 걸릴 수 있음)');
        const audioRes = await fetch(`/api/music/download/${token}`);
        alert(`5단계: 프록시 응답 status=${audioRes.status}`);
        if (audioRes.ok) {
          const blob = await audioRes.blob();
          alert(`6단계: blob 생성 완료 size=${blob.size}`);
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
          alert('7단계: 다운로드 완료');
          return;
        }
      }
    }
  } catch (e: any) {
    alert(`토큰 방식 실패: ${e?.message || e}`);
  }

  alert('폴백: CDN 직접 다운로드 시도');
  try {
    const response = await fetch(audioUrl);
    const blob = await response.blob();
    alert(`폴백 blob size=${blob.size}`);
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (e: any) {
    alert(`폴백도 실패: ${e?.message || e}. window.open으로 이동`);
    window.open(audioUrl, '_blank');
  }
}
