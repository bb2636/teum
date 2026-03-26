import { Capacitor } from '@capacitor/core';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

function getAbsoluteApiBase(): string {
  if (API_BASE.startsWith('http')) return API_BASE;
  return `${window.location.origin}${API_BASE}`;
}

export async function downloadMusicFile(
  jobId: string,
  title?: string,
  _audioUrl?: string | null
): Promise<void> {
  const sanitizedTitle = (title || 'music').replace(/[<>:"/\\|?*]/g, '_').trim() || 'music';
  const filename = `${sanitizedTitle}.mp3`;

  if (Capacitor.isNativePlatform()) {
    await downloadForNative(jobId, filename);
  } else {
    await downloadForWeb(jobId, filename);
  }
}

async function downloadForWeb(jobId: string, filename: string): Promise<void> {
  try {
    const blob = await fetchAudioBlob(jobId);
    if (!blob) {
      alert('다운로드에 실패했습니다. 다시 시도해주세요.');
      return;
    }
    triggerBlobDownload(blob, filename);
  } catch {
    alert('다운로드에 실패했습니다. 다시 시도해주세요.');
  }
}

async function downloadForNative(jobId: string, filename: string): Promise<void> {
  let savedWithFilesystem = false;

  try {
    const blob = await fetchAudioBlob(jobId);
    if (blob) {
      savedWithFilesystem = await trySaveWithFilesystem(blob, filename);
    }
  } catch (e) {
    console.error('Native download attempt failed:', e);
  }

  if (savedWithFilesystem) return;

  try {
    const tokenUrl = await getTokenDownloadUrl(jobId);
    const absoluteUrl = tokenUrl.startsWith('http') ? tokenUrl : `${getAbsoluteApiBase().replace(/\/api$/, '')}${tokenUrl}`;
    window.open(absoluteUrl, '_system');
  } catch {
    alert('다운로드에 실패했습니다. 다시 시도해주세요.');
  }
}

async function fetchAudioBlob(jobId: string): Promise<Blob | null> {
  try {
    const response = await fetch(`${API_BASE}/music/jobs/${jobId}/download`, {
      credentials: 'include',
    });
    if (response.ok) return await response.blob();
  } catch (e) {
    console.error('Server download failed:', e);
  }

  try {
    const tokenUrl = await getTokenDownloadUrl(jobId);
    const response = await fetch(tokenUrl);
    if (response.ok) return await response.blob();
  } catch (e) {
    console.error('Token download failed:', e);
  }

  return null;
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

async function trySaveWithFilesystem(blob: Blob, filename: string): Promise<boolean> {
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const base64 = await blobToBase64(blob);

    const attempts = [
      { path: `Download/${filename}`, directory: Directory.ExternalStorage },
      { path: filename, directory: Directory.Documents },
      { path: filename, directory: Directory.Cache },
    ];

    for (const attempt of attempts) {
      try {
        await Filesystem.writeFile({
          path: attempt.path,
          data: base64,
          directory: attempt.directory,
          recursive: true,
        });
        alert(`'${filename}' 저장 완료`);
        return true;
      } catch {
        continue;
      }
    }
  } catch (e) {
    console.error('Filesystem plugin not available:', e);
  }

  return false;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  }, 1000);
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
