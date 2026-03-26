import { Capacitor } from '@capacitor/core';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export async function downloadMusicFile(
  jobId: string,
  title?: string,
  _audioUrl?: string | null
): Promise<void> {
  try {
    const sanitizedTitle = (title || 'music').replace(/[<>:"/\\|?*]/g, '_').trim() || 'music';
    const filename = `${sanitizedTitle}.mp3`;
    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      await downloadForNative(jobId, filename);
    } else {
      await downloadForWeb(jobId, filename);
    }
  } catch (e: any) {
    alert(`다운로드 오류: ${e?.message || e}`);
  }
}

async function downloadForWeb(jobId: string, filename: string): Promise<void> {
  const blob = await fetchAudioBlob(jobId);
  if (!blob) {
    alert('다운로드에 실패했습니다. 다시 시도해주세요.');
    return;
  }
  triggerBlobDownload(blob, filename);
}

async function downloadForNative(jobId: string, filename: string): Promise<void> {
  const blob = await fetchAudioBlob(jobId);

  if (!blob) {
    alert('오디오 데이터를 가져올 수 없습니다.');
    return;
  }

  const saved = await trySaveWithFilesystem(blob, filename);
  if (saved) return;

  const absoluteBase = API_BASE.startsWith('http') ? API_BASE : `${window.location.origin}${API_BASE}`;

  try {
    const tokenResponse = await fetch(`${API_BASE}/music/jobs/${jobId}/download-token`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!tokenResponse.ok) throw new Error(`Token request failed: ${tokenResponse.status}`);
    const result = await tokenResponse.json();
    const downloadUrl = `${absoluteBase}/music/download/${result.data.token}`;
    window.open(downloadUrl, '_system');
  } catch (e: any) {
    alert(`다운로드 실패: ${e?.message || e}`);
  }
}

async function fetchAudioBlob(jobId: string): Promise<Blob | null> {
  try {
    const response = await fetch(`${API_BASE}/music/jobs/${jobId}/download`, {
      credentials: 'include',
    });
    if (response.ok) return await response.blob();
  } catch {}

  try {
    const tokenResponse = await fetch(`${API_BASE}/music/jobs/${jobId}/download-token`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (tokenResponse.ok) {
      const result = await tokenResponse.json();
      const tokenUrl = `${API_BASE}/music/download/${result.data.token}`;
      const response = await fetch(tokenUrl);
      if (response.ok) return await response.blob();
    }
  } catch {}

  return null;
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
  } catch {}

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
