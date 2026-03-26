import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Download } from 'lucide-react';
import { useMusicJobs, MusicJobListItem } from '@/hooks/useMusic';
import { useDiaries } from '@/hooks/useDiaries';
import { StorageImage } from '@/components/StorageImage';
import { format } from 'date-fns';
import { getDateLocale } from '@/lib/dateFnsLocale';
import { useT } from '@/hooks/useTranslation';
import type { Diary } from '@/hooks/useDiaries';
import { useAudioDurations } from '@/hooks/useAudioDuration';
import { downloadMusicFile } from '@/lib/downloadMusic';

export function MusicListPage() {
  const navigate = useNavigate();
  const t = useT();
  const locale = getDateLocale();
  const { data: jobsData } = useMusicJobs();
  const { data: diariesAll = [] } = useDiaries();

  const jobs = jobsData?.jobs ?? [];
  const completedJobs = jobs.filter((j) => j.status === 'completed' || j.status === 'lyrics_only');

  const audioJobsForDuration = useMemo(
    () => completedJobs
      .filter((j) => j.status === 'completed' && j.audioUrl)
      .map((j) => ({ jobId: j.jobId, audioUrl: j.audioUrl! })),
    [completedJobs]
  );
  const audioDurations = useAudioDurations(audioJobsForDuration);

  const diaryMap = useMemo(() => {
    const map = new Map<string, Diary>();
    diariesAll.forEach((d) => map.set(d.id, d));
    return map;
  }, [diariesAll]);

  const formatDuration = (seconds?: number) => {
    if (seconds == null) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleDownload = async (e: React.MouseEvent, job: MusicJobListItem) => {
    e.stopPropagation();
    await downloadMusicFile(job.jobId, job.title);
  };

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">{t('music.myMusic')}</h1>
          <span className="text-sm text-gray-400">{t('music.songs', { count: completedJobs.length })}</span>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-4">
        {completedJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Play className="w-8 h-8 text-gray-300" />
            </div>
            <p className="font-medium text-gray-900 mb-1">{t('music.noMusicYet')}</p>
            <p className="text-sm text-gray-400">{t('music.createFromDiaryDesc')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {completedJobs.map((job, index) => {
              const isLyricsOnly = job.status === 'lyrics_only';
              const firstDiary = (job.sourceDiaryIds || []).map((id) => diaryMap.get(id)).find(Boolean);
              const firstImage = firstDiary?.images?.[0]?.imageUrl;

              return (
                <button
                  key={job.jobId}
                  type="button"
                  onClick={() => navigate(`/music/jobs/${job.jobId}`)}
                  className="w-full flex items-center gap-3 bg-gray-50 rounded-2xl p-4 text-left hover:bg-gray-100 transition-colors animate-slide-up menu-item-tap"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <div className="w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden bg-[#E8DDD3]">
                    {firstImage ? (
                      <StorageImage
                        url={firstImage}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"
                        style={{ background: 'linear-gradient(145deg, #8B7355, #4A3C2A)' }}
                      >
                        <Play className="w-5 h-5 text-white/80" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate text-[15px]">
                      {job.title || t('music.songTitle')}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {isLyricsOnly ? t('music.lyrics') : formatDuration(audioDurations.get(job.jobId) || job.durationSeconds)}
                      {job.createdAt && ` · ${format(new Date(job.createdAt), 'M/d', { locale })}`}
                    </p>
                  </div>
                  {job.status === 'completed' && job.audioUrl && (
                    <div
                      role="button"
                      onClick={(e) => handleDownload(e, job)}
                      className="w-9 h-9 rounded-full bg-white flex items-center justify-center hover:bg-gray-200 flex-shrink-0 shadow-sm"
                    >
                      <Download className="w-4 h-4 text-gray-600" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
