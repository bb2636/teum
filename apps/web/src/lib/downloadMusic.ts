import { Capacitor } from '@capacitor/core';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export async function downloadMusicFile(
  jobId: string,
  title?: string,
  audioUrl?: string | null
): Promise<void> {
  const sanitizedTitle = (title || 'music').replace(/[<>:"/\\|?*]/g, '_').trim() || 'music';
  const filename = `${sanitizedTitle}.mp3`;

  try {
    if (Capacitor.isNativePlatform()) {
      await downloadNative(jobId, filename, audioUrl);
    } else {
      await downloadWeb(jobId, filename);
    }
  } catch (e: any) {
    console.error('Download error:', e);
    if (audioUrl) {
      window.open(audioUrl, '_blank');
    }
  }
}

async function downloadNative(jobId: string, filename: string, audioUrl?: string | null): Promise<void> {
  let blob: Blob | null = null;

  if (audioUrl) {
    try {
      const response = await fetch(audioUrl);
      if (response.ok) blob = await response.blob();
    } catch {}
  }

  if (!blob) {
    try {
      const response = await fetch(`${API_BASE}/music/jobs/${jobId}/download`, {
        credentials: 'include',
      });
      if (response.ok) blob = await response.blob();
    } catch {}
  }

  if (!blob) return;

  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const base64 = await blobToBase64(blob);

    const dirs = [
      { path: `Download/${filename}`, directory: Directory.ExternalStorage },
      { path: filename, directory: Directory.Documents },
      { path: filename, directory: Directory.Cache },
    ];

    for (const dir of dirs) {
      try {
        await Filesystem.writeFile({
          path: dir.path,
          data: base64,
          directory: dir.directory,
          recursive: true,
        });
        return;
      } catch {
        continue;
      }
    }
  } catch {}

  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
}

async function downloadWeb(jobId: string, filename: string): Promise<void> {
  let blob: Blob | null = null;

  try {
    const response = await fetch(`${API_BASE}/music/jobs/${jobId}/download`, {
      credentials: 'include',
    });
    if (response.ok) blob = await response.blob();
  } catch {}

  if (!blob) {
    try {
      const tokenRes = await fetch(`${API_BASE}/music/jobs/${jobId}/download-token`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (tokenRes.ok) {
        const result = await tokenRes.json();
        const res = await fetch(`${API_BASE}/music/download/${result.data.token}`);
        if (res.ok) blob = await res.blob();
      }
    } catch {}
  }

  if (!blob) {
    alert('다운로드에 실패했습니다. 다시 시도해주세요.');
    return;
  }

  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
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
