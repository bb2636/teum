import { Capacitor } from '@capacitor/core';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export async function downloadMusicFile(
  jobId: string,
  title?: string,
  audioUrl?: string | null
): Promise<void> {
  const sanitizedTitle = (title || 'music').replace(/[<>:"/\\|?*]/g, '_').trim() || 'music';
  const filename = `${sanitizedTitle}.mp3`;

  if (Capacitor.isNativePlatform()) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');

      const sourceUrl = audioUrl || await getTokenDownloadUrl(jobId);
      const response = await fetch(sourceUrl);
      if (!response.ok) throw new Error('Fetch failed');

      const blob = await response.blob();
      const base64 = await blobToBase64(blob);

      const dirs = [
        { path: `Download/${filename}`, directory: Directory.ExternalStorage },
        { path: filename, directory: Directory.Documents },
        { path: filename, directory: Directory.Data },
      ];

      for (const dir of dirs) {
        try {
          await Filesystem.writeFile({
            path: dir.path,
            data: base64,
            directory: dir.directory,
            recursive: true,
          });
          alert(`'${filename}' 저장 완료`);
          return;
        } catch {
          continue;
        }
      }

      throw new Error('All Filesystem directories failed');
    } catch (fsError) {
      console.error('Filesystem save failed:', fsError);
    }

    try {
      const tokenUrl = await getTokenDownloadUrl(jobId);
      window.open(tokenUrl, '_system');
    } catch {
      if (audioUrl) window.open(audioUrl, '_system');
    }
    return;
  }

  try {
    const tokenUrl = await getTokenDownloadUrl(jobId);
    window.location.href = tokenUrl;
  } catch (error) {
    console.error('Token download failed:', error);
    try {
      const response = await fetch(`${API_BASE}/music/jobs/${jobId}/download`, { credentials: 'include' });
      if (!response.ok) throw new Error('Fallback failed');

      const disposition = response.headers.get('content-disposition');
      let resolvedFilename = filename;
      if (disposition) {
        const utf8Match = disposition.match(/filename\*=UTF-8''(.+)/);
        if (utf8Match) resolvedFilename = decodeURIComponent(utf8Match[1]);
      }

      const blob = await response.blob();
      triggerBrowserDownload(blob, resolvedFilename);
    } catch {
      if (audioUrl) window.open(audioUrl, '_blank');
    }
  }
}

async function getTokenDownloadUrl(jobId: string): Promise<string> {
  const response = await fetch(`${API_BASE}/music/jobs/${jobId}/download-token`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error('Failed to create download token');
  const result = await response.json();
  return `${API_BASE}/music/download/${result.data.token}`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
}
