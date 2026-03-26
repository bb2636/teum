export async function downloadMusicFile(
  _jobId: string,
  title?: string,
  audioUrl?: string | null
): Promise<void> {
  if (!audioUrl) return;
  const filename = `${(title || 'music').replace(/[^a-zA-Z0-9가-힣\s]/g, '').replace(/\s+/g, '_')}.mp3`;

  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const dirs = [
          { path: `Download/${filename}`, directory: Directory.ExternalStorage },
          { path: filename, directory: Directory.Documents },
          { path: filename, directory: Directory.Data },
        ];
        for (const dir of dirs) {
          try {
            await Filesystem.downloadFile({
              url: audioUrl,
              path: dir.path,
              directory: dir.directory,
              recursive: true,
            });
            alert(`'${filename}' 저장 완료`);
            return;
          } catch {
            continue;
          }
        }
      } catch {
      }
    }
  } catch {
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
  } catch (error) {
    console.error('Download failed:', error);
    window.open(audioUrl, '_blank');
  }
}
