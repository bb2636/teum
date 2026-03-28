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

      const downloadUrl = `${window.location.origin}/api/music/download/${token}/${encodeURIComponent(filename)}`;
      showDownloadOverlay(downloadUrl, filename);
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

function showDownloadOverlay(url: string, filename: string) {
  const existing = document.getElementById('download-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'download-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:24px;';

  const card = document.createElement('div');
  card.style.cssText = 'background:white;border-radius:16px;padding:28px 24px;max-width:320px;width:100%;text-align:center;';

  const titleEl = document.createElement('p');
  titleEl.textContent = filename;
  titleEl.style.cssText = 'font-size:16px;font-weight:bold;color:#333;margin:0 0 8px 0;word-break:break-all;';

  const desc = document.createElement('p');
  desc.textContent = '아래 버튼을 탭하면 다운로드가 시작됩니다';
  desc.style.cssText = 'font-size:13px;color:#888;margin:0 0 20px 0;';

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.textContent = '다운로드';
  link.style.cssText = 'display:block;background:#4A2C1A;color:white;padding:14px 0;border-radius:999px;font-size:16px;font-weight:600;text-decoration:none;';

  const cancel = document.createElement('button');
  cancel.textContent = '닫기';
  cancel.style.cssText = 'display:block;width:100%;margin-top:12px;background:none;border:none;color:#888;font-size:14px;padding:8px;cursor:pointer;';
  cancel.onclick = () => overlay.remove();

  card.appendChild(titleEl);
  card.appendChild(desc);
  card.appendChild(link);
  card.appendChild(cancel);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}
