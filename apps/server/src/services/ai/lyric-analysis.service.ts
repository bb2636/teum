import { openAIProvider } from './openai.provider';
import { z } from 'zod';
import { logger } from '../../config/logger';

/**
 * Music Analysis Response Schema
 */
const musicAnalysisSchema = z.object({
  titleKo: z.string().max(10),
  titleEn: z.string().max(20).optional().default(''),
  overallEmotion: z.string(),
  mood: z.string(),
  keywords: z.array(z.string()),
  lyricalTheme: z.string(),
  lyrics: z.string(),
  musicPrompt: z.string(),
});

export type MusicAnalysisResult = z.infer<typeof musicAnalysisSchema>;

/**
 * Lyric Analysis Service
 * 
 * Handles AI-powered analysis of multiple diaries for music generation.
 * Validates and normalizes AI provider responses.
 */
export class LyricAnalysisService {
  /**
   * Analyze multiple diaries and generate music analysis.
   * 
   * @param diaries Array of diary objects to analyze
   * @returns Validated analysis result
   */
  async analyzeDiaries(diaries: Array<{
    id: string;
    title?: string;
    content?: string;
    date: string;
    type: 'free_form' | 'question_based';
    answers?: Array<{ question: string; answer: string }>;
  }>, genreTag?: string): Promise<MusicAnalysisResult> {
    if (diaries.length !== 7) {
      throw new Error('Exactly 7 diaries are required for music generation');
    }

    try {
      logger.info('Starting lyric analysis', { diaryCount: diaries.length, genreTag });

      const result = await openAIProvider.analyzeForMusic({ diaries, genreTag });

      // Validate with Zod
      const validated = musicAnalysisSchema.parse(result);

      logger.info('Lyric analysis completed', {
        overallEmotion: validated.overallEmotion,
        keywordCount: validated.keywords.length,
      });

      return validated;
    } catch (error) {
      logger.error('Lyric analysis failed', { error });
      
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid analysis response format: ${error.message}`);
      }
      
      throw error;
    }
  }
}

export const lyricAnalysisService = new LyricAnalysisService();
