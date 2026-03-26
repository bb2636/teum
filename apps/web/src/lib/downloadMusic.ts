const API_BASE = import.meta.env.VITE_API_URL || '/api';

export async function downloadMusicFile(
  jobId: string,
  title?: string,
  _audioUrl?: string | null
): Promise<void> {
  const response = await fetch(`${API_BASE}/music/jobs/${jobId}/download`, {
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Download failed');

  const disposition = response.headers.get('content-disposition');
  let filename = `${(title || 'music')}.mp3`;
  if (disposition) {
    const utf8Match = disposition.match(/filename\*=UTF-8''(.+)/);
    if (utf8Match) filename = decodeURIComponent(utf8Match[1]);
  }

  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(blobUrl);
}
