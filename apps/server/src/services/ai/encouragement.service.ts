import { openAIProvider } from './openai.provider';
import { db } from '../../db';
import { aiFeedback } from '../../db/schema';
import { diaries } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../../config/logger';

/**
 * Encouragement Service
 * 
 * Handles generation and persistence of AI encouragement messages for diaries.
 * Designed to be non-blocking - failures should not affect diary creation/update.
 */
export class EncouragementService {
  /**
   * Generate and save encouragement message for a diary.
   * This method is designed to be called asynchronously and should not throw errors
   * that would break the diary save flow.
   */
  async generateAndSaveEncouragement(
    diaryId: string,
    userId: string,
    diaryData: {
      title?: string;
      content?: string;
      type: 'free_form' | 'question_based';
      answers?: Array<{ question: string; answer: string }>;
    }
  ): Promise<void> {
    const enabled = process.env.AI_ENCOURAGEMENT_ENABLED === 'true';
    if (!enabled) {
      logger.debug('AI encouragement is disabled, skipping');
      return;
    }

    try {
      logger.info('Generating encouragement message', { diaryId });

      // Generate encouragement message
      const message = await openAIProvider.generateEncouragement(diaryData);

      // Save to ai_feedback table
      await db.insert(aiFeedback).values({
        userId,
        diaryId,
        kind: 'encouragement',
        promptVersion: '1.0',
        inputExcerpt: this.truncateContent(diaryData.content || diaryData.title || ''),
        outputText: message,
      });

      // Update diary.ai_message with latest encouragement
      await db
        .update(diaries)
        .set({ aiMessage: message })
        .where(eq(diaries.id, diaryId));

      logger.info('Encouragement message generated and saved', { diaryId });
    } catch (error) {
      // Log error but don't throw - diary save should still succeed
      logger.error('Failed to generate encouragement message', {
        diaryId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Truncate content for storage in input_excerpt field.
   */
  private truncateContent(content: string, maxLength: number = 500): string {
    if (content.length <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength) + '...';
  }
}

export const encouragementService = new EncouragementService();
