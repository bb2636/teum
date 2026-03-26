import { Capacitor } from '@capacitor/core';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export async function downloadMusicFile(
  jobId: string,
  title?: string,
  audioUrl?: string | null
): Promise<void> {
  const sanitizedTitle = (title || 'music').replace(/[<>:"/\\|?*]/g, '_').trim() || 'music';
  const filename = `${sanitizedTitle}.mp3`;

  const blob = await fetchAudioBlob(jobId, audioUrl);
  if (!blob) {
    alert('다운로드에 실패했습니다. 다시 시도해주세요.');
    return;
  }

  if (Capacitor.isNativePlatform()) {
    await saveWithCapacitorFilesystem(blob, filename);
  } else {
    saveBlobAsFile(blob, filename);
  }
}

async function fetchAudioBlob(jobId: string, _audioUrl?: string | null): Promise<Blob | null> {
  try {
    const response = await fetch(`${API_BASE}/music/jobs/${jobId}/download`, {
      credentials: 'include',
    });
    if (response.ok) return await response.blob();
  } catch (e) {
    console.error('Server download API failed:', e);
  }

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
  } catch (e) {
    console.error('Token download failed:', e);
  }

  return null;
}

async function saveWithCapacitorFilesystem(blob: Blob, filename: string): Promise<void> {
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
        return;
      } catch {
        continue;
      }
    }

    saveBlobAsFile(blob, filename);
  } catch (e) {
    console.error('Capacitor Filesystem not available:', e);
    saveBlobAsFile(blob, filename);
  }
}

function saveBlobAsFile(blob: Blob, filename: string) {
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
