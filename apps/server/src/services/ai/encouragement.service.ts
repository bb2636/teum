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
      language?: string;
    }
  ): Promise<void> {
    const enabled = process.env.AI_ENCOURAGEMENT_ENABLED === 'true';
    if (!enabled) {
      logger.debug('AI encouragement is disabled, skipping');
      return;
    }

    try {
      logger.info('Generating encouragement message', { 
        diaryId,
        type: diaryData.type,
        hasContent: !!diaryData.content,
        contentLength: diaryData.content?.length || 0,
        hasAnswers: !!diaryData.answers,
        answersCount: diaryData.answers?.length || 0,
      });

      // Generate encouragement message
      const message = await openAIProvider.generateEncouragement(diaryData);
      
      logger.info('Encouragement message generated', {
        diaryId,
        messageLength: message?.length || 0,
        messagePreview: message?.substring(0, 100) || 'empty',
      });

      const fallbackMessages = ['오늘 하루도 수고하셨어요. 당신의 기록이 소중합니다.', 'Great job today. Your record is precious.'];
      const isFallback = fallbackMessages.some(fb => message === fb);
      if (message && message.trim() && !isFallback) {
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

        logger.info('Encouragement message generated and saved', { diaryId, messageLength: message.length });
      } else {
        logger.warn('Encouragement message generation returned fallback or empty message, not saving', { diaryId });
      }
    } catch (error) {
      // Log error but don't throw - diary save should still succeed
      logger.error('Failed to generate encouragement message', {
        diaryId,
        error: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : undefined,
        errorCode: (error as any)?.code,
        errorStatus: (error as any)?.status,
        errorType: (error as any)?.type,
        stack: error instanceof Error ? error.stack : undefined,
        diaryType: diaryData.type,
        hasContent: !!diaryData.content,
        contentLength: diaryData.content?.length || 0,
        hasAnswers: !!diaryData.answers,
        answersCount: diaryData.answers?.length || 0,
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
