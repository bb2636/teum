let swRegistered = false;

async function ensureServiceWorker(): Promise<boolean> {
  if (swRegistered) return true;
  if (!('serviceWorker' in navigator)) return false;
  try {
    await navigator.serviceWorker.register('/download-sw.js');
    await navigator.serviceWorker.ready;
    swRegistered = true;
    return true;
  } catch {
    return false;
  }
}

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

            const swReady = await ensureServiceWorker();
            if (swReady) {
              const cacheUrl = `/download-cache/${encodeURIComponent(filename)}`;
              const cache = await caches.open('download-cache-v1');
              await cache.put(
                new Request(cacheUrl),
                new Response(blob, {
                  headers: {
                    'Content-Type': 'audio/mpeg',
                    'Content-Disposition': `attachment; filename="${filename}"`,
                  },
                })
              );
              const link = document.createElement('a');
              link.href = cacheUrl;
              link.download = filename;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              return;
            }

            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => window.URL.revokeObjectURL(blobUrl), 5000);
            return;
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
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 5000);
  } catch {
    window.open(audioUrl, '_blank');
  }
}
