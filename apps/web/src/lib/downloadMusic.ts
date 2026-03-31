import { apiRequest } from './api';

export async function downloadMusicFile(
  jobId: string,
  title?: string,
  audioUrl?: string | null
): Promise<void> {
  if (!audioUrl) return;
  const filename = `${(title || 'music').replace(/[^a-zA-Z0-9가-힣\s]/g, '').replace(/\s+/g, '_')}.mp3`;
  const capacitor = (window as any).Capacitor;
  const isNative = !!capacitor?.isNativePlatform?.();
  const platform = capacitor?.getPlatform?.() || 'web';
  const isIOS = platform === 'ios' || /iPad|iPhone|iPod/.test(navigator.userAgent);

  const downloadUrl = await getDownloadUrl(jobId, filename);

  if (isNative) {
    try {
      if (platform === 'android') {
        const saved = await tryNativeDownload(downloadUrl || audioUrl, filename, 'android');
        if (saved) return;
      }

      if (platform === 'ios') {
        const saved = await tryNativeDownload(downloadUrl || audioUrl, filename, 'ios');
        if (saved) return;
      }

      try {
        const { Browser } = await import('@capacitor/browser');
        await Browser.open({ url: downloadUrl || audioUrl });
        return;
      } catch {
        window.open(downloadUrl || audioUrl, '_system');
        return;
      }
    } catch (err: any) {
      alert(`다운로드 오류: ${err?.message || String(err)}`);
    }
    return;
  }

  if (downloadUrl) {
    if (isIOS) {
      window.location.href = downloadUrl;
    } else {
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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

async function getDownloadUrl(jobId: string, filename: string): Promise<string | null> {
  try {
    const tokenData = await apiRequest<{ data: { token: string } }>(`/music/jobs/${jobId}/download-token`, {
      method: 'POST',
    });
    const token = (tokenData as any)?.data?.token || (tokenData as any)?.token;
    if (token) {
      return `${window.location.origin}/api/music/download/${token}/${encodeURIComponent(filename)}`;
    }
  } catch {}
  return null;
}

async function tryNativeDownload(url: string, filename: string, platform: string): Promise<boolean> {
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');

    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Download fetch failed: ${response.status}`);
      return false;
    }

    const blob = await response.blob();
    const base64 = await blobToBase64(blob);

    if (platform === 'android') {
      try {
        await Filesystem.writeFile({
          path: `Download/${filename}`,
          data: base64,
          directory: Directory.ExternalStorage,
          recursive: true,
        });
        alert(`"${filename}" 파일이 다운로드 폴더에 저장되었습니다.`);
        return true;
      } catch (e1) {
        console.warn('ExternalStorage write failed, trying Documents:', e1);
        try {
          await Filesystem.writeFile({
            path: filename,
            data: base64,
            directory: Directory.Documents,
            recursive: true,
          });
          alert(`"${filename}" 파일이 Documents 폴더에 저장되었습니다.`);
          return true;
        } catch (e2) {
          console.warn('Documents write also failed:', e2);
          try {
            await Filesystem.writeFile({
              path: filename,
              data: base64,
              directory: Directory.Cache,
              recursive: true,
            });
            const fileUri = await Filesystem.getUri({
              path: filename,
              directory: Directory.Cache,
            });
            if (fileUri?.uri) {
              try {
                const { Share } = await import('@capacitor/share');
                await Share.share({
                  title: filename,
                  url: fileUri.uri,
                });
                return true;
              } catch {
                alert(`파일이 저장되었습니다: ${fileUri.uri}`);
                return true;
              }
            }
          } catch (e3) {
            console.warn('Cache write also failed:', e3);
          }
        }
      }
      return false;
    }

    if (platform === 'ios') {
      try {
        await Filesystem.writeFile({
          path: filename,
          data: base64,
          directory: Directory.Documents,
          recursive: true,
        });
        alert(`"${filename}" 파일이 저장되었습니다.\n\n파일 앱 > 이 iPhone > Teum 폴더에서 확인할 수 있습니다.`);
        return true;
      } catch (err) {
        console.warn('iOS Filesystem write failed:', err);
        return false;
      }
    }

    return false;
  } catch (err) {
    console.warn('Native download failed:', err);
    return false;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
