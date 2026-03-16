/**
 * AI Provider Interface
 * 
 * Abstracts AI text generation capabilities.
 * Implementations should handle vendor-specific API calls and error handling.
 */
export interface AIProvider {
  /**
   * Generate an encouragement message for a diary entry.
   * 
   * @param input Diary content and metadata
   * @returns A single Korean encouragement sentence
   */
  generateEncouragement(input: {
    title?: string;
    content?: string;
    type: 'free_form' | 'question_based';
    answers?: Array<{ question: string; answer: string }>;
  }): Promise<string>;

  /**
   * Analyze multiple diaries for music generation.
   * 
   * @param diaries Array of diary objects with content
   * @returns Structured analysis including emotion, keywords, lyrics, and music prompt
   */
  analyzeForMusic(input: {
    diaries: Array<{
      id: string;
      title?: string;
      content?: string;
      date: string;
      type: 'free_form' | 'question_based';
      answers?: Array<{ question: string; answer: string }>;
    }>;
  }): Promise<{
    overallEmotion: string;
    mood: string;
    keywords: string[];
    lyricalTheme: string;
    lyrics: string;
    musicPrompt: string;
  }>;
}
