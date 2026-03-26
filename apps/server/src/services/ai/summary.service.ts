import { openAIProvider } from './openai.provider';
import { db } from '../../db';
import { diaries } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../../config/logger';

export class SummaryService {
  async generateAndSaveSummary(
    diaryId: string,
    diaryData: {
      title?: string;
      content?: string;
      type: 'free_form' | 'question_based';
      answers?: Array<{ question: string; answer: string }>;
    }
  ): Promise<void> {
    const enabled = process.env.AI_ENCOURAGEMENT_ENABLED === 'true';
    if (!enabled) {
      return;
    }

    try {
      const summary = await openAIProvider.generateSummary(diaryData);

      if (summary && summary.trim()) {
        await db
          .update(diaries)
          .set({ aiSummary: summary })
          .where(eq(diaries.id, diaryId));

        logger.info('AI summary generated and saved', { diaryId, summaryLength: summary.length });
      }
    } catch (error) {
      logger.error('Failed to generate summary', {
        diaryId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const summaryService = new SummaryService();
