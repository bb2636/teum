import { db } from '../../db';
import { musicJobs } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { lyricAnalysisService } from '../ai/lyric-analysis.service';
import { murekaProvider } from './mureka.provider';
import { diaryRepository } from '../../repositories/diary.repository';
import { logger } from '../../config/logger';

/**
 * Music Orchestrator Service
 *
 * 플로우: 일기 7개 선택 → GPT 분석·가사 생성 → Mureka 가사 기반 작곡(·썸네일)
 * 1. Create music job
 * 2. GPT(lyricAnalysisService)로 일기 분석 → overallEmotion, mood, lyrics, musicPrompt
 * 3. Mureka API: lyrics + prompt(스타일)로 작곡 요청 (비동기 task_id 반환)
 * 4. 폴링으로 완료 조회 → audioUrl(·thumbnailUrl) 저장
 */
export class MusicOrchestratorService {
  /**
   * Generate music from 7 selected diaries and optional genre.
   *
   * @param userId User ID
   * @param diaryIds Array of exactly 7 diary IDs
   * @param genreTag Optional Mureka style tag (e.g. pop, ballad); used as primary genre in prompt
   * @returns Music job result
   */
  async generateMusic(
    userId: string,
    diaryIds: string[],
    genreTag?: string
  ): Promise<{
    jobId: string;
    status: 'queued' | 'processing' | 'completed' | 'failed' | 'lyrics_only';
    overallEmotion?: string;
    mood?: string;
    keywords?: string[];
    lyricalTheme?: string;
    lyrics?: string;
    musicPrompt?: string;
    audioUrl?: string;
    title?: string;
    titleEn?: string;
  }> {
    if (diaryIds.length !== 7) {
      throw new Error('Exactly 7 diaries are required');
    }

    // Create music job
    const [job] = await db
      .insert(musicJobs)
      .values({
        userId,
        status: 'queued',
        sourceDiaryIds: diaryIds,
      })
      .returning();

    const jobId = job.id;

    try {
      // Update status to processing
      await db
        .update(musicJobs)
        .set({ status: 'processing' })
        .where(eq(musicJobs.id, jobId));

      logger.info('Music generation started', { jobId, diaryIds });

      // Load diaries
      const diaries = await Promise.all(
        diaryIds.map((id) => diaryRepository.findById(id))
      );

      // Verify all diaries exist and belong to user
      for (const diary of diaries) {
        if (!diary) {
          throw new Error(`Diary not found: ${diaryIds[diaries.indexOf(diary)]}`);
        }
        if (diary.userId !== userId) {
          throw new Error(`Diary does not belong to user: ${diaryIds[diaries.indexOf(diary)]}`);
        }
      }

      // Prepare diary data for analysis
      // Use answers from the loaded diary if available, otherwise fetch separately
      const diaryData = await Promise.all(
        diaries.map(async (diary) => {
          if (!diary) {
            throw new Error('Diary not found');
          }
          // If diary already has answers loaded, use them; otherwise fetch
          const answers = diary.answers || await diaryRepository.findAnswersByDiaryId(diary.id);
          return {
            id: diary.id,
            title: diary.title || undefined,
            content: diary.content || undefined,
            date: diary.date.toISOString(),
            type: diary.type,
            answers: answers.map((a: { question?: { question?: string }; answer: string }) => ({
              question: a.question?.question || '',
              answer: a.answer,
            })),
          };
        })
      );

      // Analyze with AI
      const analysis = await lyricAnalysisService.analyzeDiaries(diaryData);

      // Save analysis results immediately BEFORE calling Mureka
      await db
        .update(musicJobs)
        .set({
          overallEmotion: analysis.overallEmotion,
          mood: analysis.mood,
          keywords: analysis.keywords,
          lyricalTheme: analysis.lyricalTheme,
          lyrics: analysis.lyrics,
          musicPrompt: analysis.musicPrompt,
          songTitle: analysis.titleKo,
          songTitleEn: analysis.titleEn,
        })
        .where(eq(musicJobs.id, jobId));

      // Generate music (Mureka API). 사용자 선택 장르가 있으면 프롬프트 앞에 반영.
      const stylePrefix = genreTag?.trim()
        ? `${genreTag.trim()}, `
        : '';
      const titlePrefix = analysis.titleKo
        ? `song title: "${analysis.titleKo}"${analysis.titleEn ? ` (${analysis.titleEn})` : ''}, `
        : '';
      const promptForMureka =
        stylePrefix +
        titlePrefix +
        analysis.musicPrompt +
        ', up to 2 minutes total length, natural fade-out ending, complete musical phrases, no abrupt cut or mid-phrase ending';

      let musicResult;
      try {
        musicResult = await murekaProvider.generateMusic({
          prompt: promptForMureka,
          lyrics: analysis.lyrics,
          durationSeconds: 120,
          mode: 'bgm',
        });
      } catch (murekaError) {
        const murekaMsg = murekaError instanceof Error ? murekaError.message : String(murekaError);
        const isQuotaOrLimit =
          murekaMsg.includes('429') ||
          murekaMsg.toLowerCase().includes('quota') ||
          murekaMsg.toLowerCase().includes('exceeded') ||
          murekaMsg.toLowerCase().includes('limit') ||
          murekaMsg.toLowerCase().includes('rate');

        if (!isQuotaOrLimit) {
          throw murekaError;
        }

        logger.warn('Mureka quota/rate limit exceeded, saving as lyrics_only', {
          jobId,
          error: murekaMsg,
        });

        await db
          .update(musicJobs)
          .set({
            status: 'lyrics_only',
            errorMessage: murekaMsg,
            completedAt: new Date(),
          })
          .where(eq(musicJobs.id, jobId));

        return {
          jobId,
          status: 'lyrics_only' as const,
          overallEmotion: analysis.overallEmotion,
          mood: analysis.mood,
          keywords: analysis.keywords,
          lyricalTheme: analysis.lyricalTheme,
          lyrics: analysis.lyrics,
          musicPrompt: analysis.musicPrompt,
          title: analysis.titleKo,
          titleEn: analysis.titleEn,
        };
      }

      // Save Mureka provider info
      await db
        .update(musicJobs)
        .set({
          provider: musicResult.provider,
          providerJobId: musicResult.providerJobId,
        })
        .where(eq(musicJobs.id, jobId));

      // Handle async vs sync generation
      if (musicResult.audioUrl) {
        await db
          .update(musicJobs)
          .set({
            status: 'completed',
            audioUrl: musicResult.audioUrl,
            completedAt: new Date(),
          })
          .where(eq(musicJobs.id, jobId));

        logger.info('Music generation completed (synchronous)', { jobId });

        return {
          jobId,
          status: 'completed' as const,
          overallEmotion: analysis.overallEmotion,
          mood: analysis.mood,
          keywords: analysis.keywords,
          lyricalTheme: analysis.lyricalTheme,
          lyrics: analysis.lyrics,
          musicPrompt: analysis.musicPrompt,
          audioUrl: musicResult.audioUrl,
          title: analysis.titleKo,
          titleEn: analysis.titleEn,
        };
      } else if (musicResult.providerJobId) {
        logger.info('Music generation started (asynchronous)', {
          jobId,
          providerJobId: musicResult.providerJobId,
        });

        return {
          jobId,
          status: 'processing' as const,
          overallEmotion: analysis.overallEmotion,
          mood: analysis.mood,
          keywords: analysis.keywords,
          lyricalTheme: analysis.lyricalTheme,
          lyrics: analysis.lyrics,
          musicPrompt: analysis.musicPrompt,
          title: analysis.titleKo,
          titleEn: analysis.titleEn,
        };
      } else {
        throw new Error('No audio URL or job ID returned from provider');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await db
        .update(musicJobs)
        .set({
          status: 'failed',
          errorMessage,
        })
        .where(eq(musicJobs.id, jobId));

      logger.error('Music generation failed', { jobId, error: errorMessage });

      throw error;
    }
  }
}

export const musicOrchestratorService = new MusicOrchestratorService();
