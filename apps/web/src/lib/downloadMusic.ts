import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

export async function downloadMusicFile(
  _jobId: string,
  title?: string,
  audioUrl?: string | null
): Promise<void> {
  if (!audioUrl) return;
  const filename = `${(title || 'music').replace(/[^a-zA-Z0-9가-힣\s]/g, '').replace(/\s+/g, '_')}.mp3`;

  if (Capacitor.isNativePlatform()) {
    try {
      const dirs = [
        { path: `Download/${filename}`, directory: Directory.ExternalStorage },
        { path: filename, directory: Directory.Documents },
        { path: filename, directory: Directory.Data },
      ];
      let saved = false;
      for (const dir of dirs) {
        try {
          await Filesystem.downloadFile({
            url: audioUrl,
            path: dir.path,
            directory: dir.directory,
            recursive: true,
          });
          saved = true;
          break;
        } catch {
          continue;
        }
      }
      if (saved) {
        alert(`'${filename}' 저장 완료`);
      } else {
        window.open(audioUrl, '_blank');
      }
    } catch (error) {
      console.error('Native download failed:', error);
      window.open(audioUrl, '_blank');
    }
  } else {
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
    } catch (error) {
      console.error('Download failed:', error);
      window.open(audioUrl, '_blank');
    }
  }
}
