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
  const targetUrl = downloadUrl || audioUrl;

  if (isNative) {
    await handleNativeDownload(targetUrl, filename, platform);
    return;
  }

  if (isIOS) {
    await handleIOSWebDownload(targetUrl, filename);
    return;
  }

  if (downloadUrl) {
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

async function handleIOSWebDownload(url: string, filename: string): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const file = new File([blob], filename, { type: 'audio/mpeg' });

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: filename,
      });
      return;
    }

    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);
  } catch (err: any) {
    alert(`다운로드에 실패했습니다: ${err?.message || '네트워크 오류'}`);
  }
}

async function handleNativeDownload(url: string, filename: string, platform: string): Promise<void> {
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');

    let base64Data: string;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const blob = await response.blob();
      base64Data = await blobToBase64(blob);
    } catch (fetchErr: any) {
      alert(`파일 다운로드에 실패했습니다: ${fetchErr?.message || '네트워크 오류'}`);
      return;
    }

    if (platform === 'android') {
      try {
        await Filesystem.writeFile({
          path: filename,
          data: base64Data,
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
            return;
          } catch {
            alert(`"${filename}" 파일이 저장되었습니다.`);
            return;
          }
        }
      } catch (cacheErr) {
        console.warn('Cache+Share failed:', cacheErr);
      }

      const fallbackDirs = [
        { path: `Download/${filename}`, dir: Directory.ExternalStorage, label: '다운로드 폴더' },
        { path: filename, dir: Directory.Documents, label: 'Documents 폴더' },
        { path: filename, dir: Directory.Data, label: '앱 저장소' },
      ];
      for (const { path, dir, label } of fallbackDirs) {
        try {
          await Filesystem.writeFile({
            path,
            data: base64Data,
            directory: dir,
            recursive: true,
          });
          alert(`"${filename}" 파일이 ${label}에 저장되었습니다.`);
          return;
        } catch (e) {
          console.warn(`${label} write failed:`, e);
        }
      }
      alert('파일 저장에 실패했습니다. 다시 시도해주세요.');
      return;
    }

    if (platform === 'ios') {
      try {
        await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true,
        });
        alert(`"${filename}" 파일이 저장되었습니다.\n\n파일 앱 > 이 iPhone > Teum 폴더에서 확인할 수 있습니다.`);
        return;
      } catch (err) {
        console.warn('iOS Documents write failed:', err);
      }

      try {
        await Filesystem.writeFile({
          path: filename,
          data: base64Data,
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
            return;
          } catch {
            alert(`"${filename}" 파일이 저장되었습니다.`);
            return;
          }
        }
      } catch (err2) {
        console.warn('iOS Cache+Share failed:', err2);
      }

      alert('파일 저장에 실패했습니다. 기기 저장 공간을 확인해주세요.');
      return;
    }
  } catch (err: any) {
    alert(`다운로드 오류: ${err?.message || String(err)}`);
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
