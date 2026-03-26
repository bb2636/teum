import { Capacitor } from '@capacitor/core';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export async function downloadMusicFile(
  jobId: string,
  title?: string,
  audioUrl?: string | null
): Promise<void> {
  const sanitizedTitle = (title || 'music').replace(/[<>:"/\\|?*]/g, '_').trim() || 'music';
  const filename = `${sanitizedTitle}.mp3`;

  if (Capacitor.isNativePlatform() && audioUrl) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');

      const response = await fetch(audioUrl);
      if (!response.ok) throw new Error('Audio fetch failed');

      const blob = await response.blob();
      const base64 = await blobToBase64(blob);

      try {
        await Filesystem.writeFile({
          path: `Download/${filename}`,
          data: base64,
          directory: Directory.ExternalStorage,
          recursive: true,
        });
      } catch {
        try {
          await Filesystem.writeFile({
            path: filename,
            data: base64,
            directory: Directory.Documents,
            recursive: true,
          });
        } catch {
          await Filesystem.writeFile({
            path: filename,
            data: base64,
            directory: Directory.Data,
            recursive: true,
          });
        }
      }

      alert(`'${filename}' 저장 완료`);
      return;
    } catch (error) {
      console.error('Native Filesystem download failed:', error);
    }
  }

  if (Capacitor.isNativePlatform() && audioUrl) {
    try {
      const response = await fetch(audioUrl);
      if (!response.ok) throw new Error('Audio fetch failed');
      const blob = await response.blob();
      triggerBrowserDownload(blob, filename);
      return;
    } catch (error) {
      console.error('Native blob download failed:', error);
    }
  }

  try {
    const downloadUrl = `${API_BASE}/music/jobs/${jobId}/download`;
    const response = await fetch(downloadUrl, { credentials: 'include' });
    if (!response.ok) throw new Error('Download API failed');

    const disposition = response.headers.get('content-disposition');
    let resolvedFilename = filename;
    if (disposition) {
      const utf8Match = disposition.match(/filename\*=UTF-8''(.+)/);
      if (utf8Match) resolvedFilename = decodeURIComponent(utf8Match[1]);
    }

    const blob = await response.blob();
    triggerBrowserDownload(blob, resolvedFilename);
  } catch (error) {
    console.error('Server download failed:', error);
    if (audioUrl) {
      try {
        const response = await fetch(audioUrl);
        const blob = await response.blob();
        triggerBrowserDownload(blob, filename);
      } catch {
        window.open(audioUrl, '_blank');
      }
    }
  }
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
