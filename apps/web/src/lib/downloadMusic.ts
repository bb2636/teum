import { Capacitor } from '@capacitor/core';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

function parseFilename(disposition: string | null, fallback: string): string {
  if (disposition) {
    const utf8Match = disposition.match(/filename\*=UTF-8''(.+)/);
    if (utf8Match) return decodeURIComponent(utf8Match[1]);
  }
  return fallback;
}

async function fetchAudioBlob(downloadUrl: string) {
  const response = await fetch(downloadUrl, { credentials: 'include' });
  if (!response.ok) throw new Error('Download failed');
  return {
    blob: await response.blob(),
    disposition: response.headers.get('content-disposition'),
  };
}

export async function downloadMusicFile(jobId: string, title?: string): Promise<void> {
  const fallbackName = `${(title || 'music')}.mp3`;
  const downloadUrl = `${API_BASE}/music/jobs/${jobId}/download`;

  if (Capacitor.isNativePlatform()) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');

      const { blob, disposition } = await fetchAudioBlob(downloadUrl);
      const filename = parseFilename(disposition, fallbackName);
      const sanitized = filename.replace(/[<>:"/\\|?*]/g, '_');

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      try {
        await Filesystem.writeFile({
          path: sanitized,
          data: base64,
          directory: Directory.Documents,
          recursive: true,
        });
      } catch {
        await Filesystem.writeFile({
          path: sanitized,
          data: base64,
          directory: Directory.Data,
          recursive: true,
        });
      }

      alert(`'${sanitized}' 저장 완료`);
    } catch (error) {
      console.error('Native download failed, falling back:', error);
      const { blob, disposition } = await fetchAudioBlob(downloadUrl);
      const filename = parseFilename(disposition, fallbackName);
      triggerBrowserDownload(blob, filename);
    }
  } else {
    try {
      const { blob, disposition } = await fetchAudioBlob(downloadUrl);
      const filename = parseFilename(disposition, fallbackName);
      triggerBrowserDownload(blob, filename);
    } catch (error) {
      console.error('Download failed:', error);
    }
  }
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(blobUrl);
}
