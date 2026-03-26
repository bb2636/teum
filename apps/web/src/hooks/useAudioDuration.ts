import { useState, useEffect } from 'react';

const durationCache = new Map<string, number>();

export function useAudioDuration(audioUrl: string | null | undefined): number | null {
  const [duration, setDuration] = useState<number | null>(() => {
    if (audioUrl && durationCache.has(audioUrl)) {
      return durationCache.get(audioUrl)!;
    }
    return null;
  });

  useEffect(() => {
    if (!audioUrl) return;

    if (durationCache.has(audioUrl)) {
      setDuration(durationCache.get(audioUrl)!);
      return;
    }

    const audio = new Audio();
    let cancelled = false;

    const onLoaded = () => {
      if (cancelled) return;
      const dur = Math.round(audio.duration);
      if (dur > 0 && isFinite(dur)) {
        durationCache.set(audioUrl, dur);
        setDuration(dur);
      }
      cleanup();
    };

    const onError = () => {
      cleanup();
    };

    const cleanup = () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('error', onError);
      audio.src = '';
    };

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('error', onError);
    audio.preload = 'metadata';
    audio.src = audioUrl;

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [audioUrl]);

  return duration;
}

export function useAudioDurations(jobs: Array<{ jobId: string; audioUrl?: string | null }>): Map<string, number> {
  const [durations, setDurations] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const pending: Array<{ jobId: string; audioUrl: string }> = [];

    for (const job of jobs) {
      if (!job.audioUrl) continue;
      if (durationCache.has(job.audioUrl)) {
        continue;
      }
      pending.push({ jobId: job.jobId, audioUrl: job.audioUrl });
    }

    const cachedMap = new Map<string, number>();
    for (const job of jobs) {
      if (job.audioUrl && durationCache.has(job.audioUrl)) {
        cachedMap.set(job.jobId, durationCache.get(job.audioUrl)!);
      }
    }
    if (cachedMap.size > 0) {
      setDurations((prev) => {
        const merged = new Map(prev);
        cachedMap.forEach((v, k) => merged.set(k, v));
        return merged;
      });
    }

    if (pending.length === 0) return;

    let cancelled = false;
    const audios: HTMLAudioElement[] = [];

    for (const { jobId, audioUrl } of pending) {
      const audio = new Audio();
      audios.push(audio);

      audio.addEventListener('loadedmetadata', () => {
        if (cancelled) return;
        const dur = Math.round(audio.duration);
        if (dur > 0 && isFinite(dur)) {
          durationCache.set(audioUrl, dur);
          setDurations((prev) => {
            const next = new Map(prev);
            next.set(jobId, dur);
            return next;
          });
        }
        audio.src = '';
      }, { once: true });

      audio.addEventListener('error', () => {
        audio.src = '';
      }, { once: true });

      audio.preload = 'metadata';
      audio.src = audioUrl;
    }

    return () => {
      cancelled = true;
      for (const a of audios) {
        a.src = '';
      }
    };
  }, [jobs.map((j) => `${j.jobId}:${j.audioUrl || ''}`).join(',')]);

  return durations;
}
