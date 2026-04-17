import { openAIProvider } from './openai.provider';
import { db } from '../../db';
import { diaries } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../../config/logger';

export class TitleService {
  /**
   * 일기 제목이 비어 있을 때 AI로 제목을 생성하여 저장한다.
   * 이미 제목이 있는 일기에는 동작하지 않는다 (호출 측에서 가드).
   */
  async generateAndSaveTitle(
    diaryId: string,
    diaryData: {
      content?: string;
      type: 'free_form' | 'question_based';
      answers?: Array<{ question: string; answer: string }>;
      language?: string;
    }
  ): Promise<void> {
    const enabled = process.env.AI_ENCOURAGEMENT_ENABLED === 'true';
    if (!enabled) {
      return;
    }

    try {
      if (typeof openAIProvider.generateTitle !== 'function') {
        return;
      }

      const title = await openAIProvider.generateTitle(diaryData);

      if (title && title.trim()) {
        const trimmed = title.trim().slice(0, 100);

        const current = await db
          .select({ title: diaries.title })
          .from(diaries)
          .where(eq(diaries.id, diaryId))
          .limit(1);

        if (current[0]?.title && current[0].title.trim().length > 0) {
          return;
        }

        await db
          .update(diaries)
          .set({ title: trimmed })
          .where(eq(diaries.id, diaryId));

        logger.info('AI title generated and saved', { diaryId, titleLength: trimmed.length });
      }
    } catch (error) {
      logger.error('Failed to generate title', {
        diaryId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const titleService = new TitleService();
