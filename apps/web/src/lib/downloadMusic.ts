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
          { label: 'ExternalStorage/Download', path: `Download/${filename}`, directory: Directory.ExternalStorage },
          { label: 'Documents', path: filename, directory: Directory.Documents },
          { label: 'Data', path: filename, directory: Directory.Data },
        ];
        for (const dir of dirs) {
          try {
            await Filesystem.downloadFile({
              url: audioUrl,
              path: dir.path,
              directory: dir.directory,
              recursive: true,
            });
            alert(`'${filename}' 저장 완료 (${dir.label})`);
            return;
          } catch (e: any) {
            console.error(`Filesystem ${dir.label} failed:`, e?.message || e);
            continue;
          }
        }
        alert(`모든 저장 경로 실패. 기본 다운로드로 전환합니다.`);
      } catch (e: any) {
        alert(`Filesystem import 실패: ${e?.message || e}`);
      }
    }
  } catch (e: any) {
    alert(`Capacitor import 실패: ${e?.message || e}`);
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
