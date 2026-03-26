const API_BASE = import.meta.env.VITE_API_URL || '/api';

export async function downloadMusicFile(
  jobId: string,
  title?: string,
  audioUrl?: string | null
): Promise<void> {
  try {
    let blob: Blob | null = null;
    let filename = `${(title || 'music').replace(/[<>:"/\\|?*]/g, '_')}.mp3`;

    try {
      const response = await fetch(`${API_BASE}/music/jobs/${jobId}/download`, {
        credentials: 'include',
      });
      if (response.ok) {
        const disposition = response.headers.get('content-disposition');
        if (disposition) {
          const utf8Match = disposition.match(/filename\*=UTF-8''(.+)/);
          if (utf8Match) filename = decodeURIComponent(utf8Match[1]);
        }
        blob = await response.blob();
      }
    } catch {}

    if (!blob && audioUrl) {
      try {
        const response = await fetch(audioUrl);
        if (response.ok) blob = await response.blob();
      } catch {}
    }

    if (!blob) {
      alert('다운로드에 실패했습니다. 다시 시도해주세요.');
      return;
    }

    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (e: any) {
    alert(`다운로드 오류: ${e?.message || '알 수 없는 오류'}`);
  }
}
