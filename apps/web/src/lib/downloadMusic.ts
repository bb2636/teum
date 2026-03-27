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
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const tokenRes = await fetch(`/api/music/jobs/${jobId}/download-token`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        const token = tokenData?.data?.token;
        if (token) {
          const audioRes = await fetch(`/api/music/download/${token}`);
          if (audioRes.ok) {
            const blob = await audioRes.blob();
            const base64 = await blobToBase64(blob);
            try {
              const { Filesystem, Directory } = await import('@capacitor/filesystem');
              const dirs = [
                { label: 'Documents', path: filename, directory: Directory.Documents },
                { label: 'Data', path: filename, directory: Directory.Data },
              ];
              for (const dir of dirs) {
                try {
                  await Filesystem.writeFile({
                    path: dir.path,
                    data: base64,
                    directory: dir.directory,
                    recursive: true,
                  });
                  alert(`'${filename}' 저장 완료 (${dir.label})`);
                  return;
                } catch {
                  continue;
                }
              }
            } catch {}
          }
        }
      }
    } catch {}
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
  } catch {
    window.open(audioUrl, '_blank');
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
