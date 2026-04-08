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

    if (platform === 'android') {
      const downloadDirs = [
        { path: filename, dir: Directory.Cache, label: 'Cache' },
        { path: filename, dir: Directory.Data, label: 'Data' },
        { path: filename, dir: Directory.Documents, label: 'Documents' },
        { path: `Download/${filename}`, dir: Directory.ExternalStorage, label: 'ExternalStorage' },
      ];

      let savedUri: string | null = null;
      const errors: string[] = [];

      for (const { path, dir, label } of downloadDirs) {
        try {
          if (typeof (Filesystem as any).downloadFile === 'function') {
            await (Filesystem as any).downloadFile({
              url,
              path,
              directory: dir,
              recursive: true,
            });
          } else {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const blob = await response.blob();
            const base64 = await blobToBase64(blob);
            await Filesystem.writeFile({
              path,
              data: base64,
              directory: dir,
              recursive: true,
            });
          }
          const uriResult = await Filesystem.getUri({ path, directory: dir });
          savedUri = uriResult?.uri || null;
          break;
        } catch (e: any) {
          errors.push(`${label}: ${e?.message || String(e)}`);
        }
      }

      if (savedUri) {
        try {
          const { Share } = await import('@capacitor/share');
          await Share.share({ title: filename, url: savedUri });
        } catch {
          alert(`"${filename}" 파일이 저장되었습니다.`);
        }
        return;
      }

      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const file = new File([blob], filename, { type: 'audio/mpeg' });
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: filename });
          return;
        }
      } catch (shareErr: any) {
        errors.push(`WebShare: ${shareErr?.message || String(shareErr)}`);
      }

      await showUrlCopyFallback(url, filename, errors);
      return;
    }

    if (platform === 'ios') {
      try {
        const tempPath = `temp_${Date.now()}_${filename}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const base64 = await blobToBase64(blob);
        await Filesystem.writeFile({
          path: tempPath,
          data: base64,
          directory: Directory.Cache,
          recursive: true,
        });
        const uriResult = await Filesystem.getUri({ path: tempPath, directory: Directory.Cache });

        if (uriResult?.uri) {
          const { Share } = await import('@capacitor/share');
          await Share.share({ title: filename, url: uriResult.uri });
          Filesystem.deleteFile({ path: tempPath, directory: Directory.Cache }).catch(() => {});
        } else {
          throw new Error('Failed to get file URI');
        }
        return;
      } catch (e: any) {
        try {
          const resp = await fetch(url);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const blob = await resp.blob();
          const file = new File([blob], filename, { type: 'audio/mpeg' });
          if (navigator.share && navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], title: filename });
            return;
          }
        } catch {}
        await showUrlCopyFallback(url, filename, [e?.message || String(e)]);
        return;
      }
    }
  } catch (err: any) {
    alert(`다운로드 오류: ${err?.message || String(err)}`);
  }
}

async function showUrlCopyFallback(url: string, _filename?: string, _errors?: string[]): Promise<void> {
  try {
    await navigator.clipboard.writeText(url);
    alert(`다른 방법으로 다운로드해주세요.\n\n다운로드 URL이 클립보드에 복사되었습니다.\n브라우저에 붙여넣기하면 다운로드할 수 있습니다.`);
  } catch {
    const msg = `다운로드 URL을 복사해서 브라우저에서 열어주세요:\n\n${url}`;
    alert(msg);
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
