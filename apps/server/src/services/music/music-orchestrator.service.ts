import { db } from '../../db';
import { musicJobs } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { lyricAnalysisService } from '../ai/lyric-analysis.service';
import { stableAudioProvider } from './stableaudio.provider';
import { diaryRepository } from '../../repositories/diary.repository';
import { logger } from '../../config/logger';

/**
 * Music Orchestrator Service
 * 
 * Coordinates the full music generation flow:
 * 1. Create music job
 * 2. Analyze diaries with AI
 * 3. Generate music with provider
 * 4. Save results
 */
export class MusicOrchestratorService {
  /**
   * Generate music from 7 selected diaries.
   * 
   * @param userId User ID
   * @param diaryIds Array of exactly 7 diary IDs
   * @returns Music job result
   */
  async generateMusic(
    userId: string,
    diaryIds: string[]
  ): Promise<{
    jobId: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    overallEmotion?: string;
    mood?: string;
    keywords?: string[];
    lyricalTheme?: string;
    lyrics?: string;
    musicPrompt?: string;
    audioUrl?: string;
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

      // Generate music
      const musicResult = await stableAudioProvider.generateMusic({
        prompt: analysis.musicPrompt,
        durationSeconds: 30, // Default 30 seconds
      });

      // Save analysis results immediately
      await db
        .update(musicJobs)
        .set({
          overallEmotion: analysis.overallEmotion,
          mood: analysis.mood,
          keywords: analysis.keywords,
          lyricalTheme: analysis.lyricalTheme,
          lyrics: analysis.lyrics,
          musicPrompt: analysis.musicPrompt,
          provider: musicResult.provider,
          providerJobId: musicResult.providerJobId,
        })
        .where(eq(musicJobs.id, jobId));

      // Handle async vs sync generation
      if (musicResult.audioUrl) {
        // Synchronous: Audio is ready immediately
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
          status: 'completed',
          overallEmotion: analysis.overallEmotion,
          mood: analysis.mood,
          keywords: analysis.keywords,
          lyricalTheme: analysis.lyricalTheme,
          lyrics: analysis.lyrics,
          musicPrompt: analysis.musicPrompt,
          audioUrl: musicResult.audioUrl,
        };
      } else if (musicResult.providerJobId) {
        // Asynchronous: Job ID returned, will be polled
        // Register webhook if available
        const webhookUrl = process.env.WEBHOOK_BASE_URL
          ? `${process.env.WEBHOOK_BASE_URL}/api/music/webhook/${jobId}`
          : undefined;

        if (webhookUrl) {
          await stableAudioProvider.registerWebhook(musicResult.providerJobId, webhookUrl);
        }

        // Job will be polled by background worker or webhook
        logger.info('Music generation started (asynchronous)', {
          jobId,
          providerJobId: musicResult.providerJobId,
        });

        return {
          jobId,
          status: 'processing',
          overallEmotion: analysis.overallEmotion,
          mood: analysis.mood,
          keywords: analysis.keywords,
          lyricalTheme: analysis.lyricalTheme,
          lyrics: analysis.lyrics,
          musicPrompt: analysis.musicPrompt,
        };
      } else {
        throw new Error('No audio URL or job ID returned from provider');
      }
    } catch (error) {
      // Mark job as failed
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
