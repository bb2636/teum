export interface AIProvider {
  generateEncouragement(input: {
    title?: string;
    content?: string;
    type: 'free_form' | 'question_based';
    answers?: Array<{ question: string; answer: string }>;
    language?: string;
  }): Promise<string>;

  analyzeForMusic(input: {
    diaries: Array<{
      id: string;
      title?: string;
      content?: string;
      date: string;
      type: 'free_form' | 'question_based';
      answers?: Array<{ question: string; answer: string }>;
    }>;
    genreTag?: string;
  }): Promise<{
    overallEmotion: string;
    mood: string;
    keywords: string[];
    lyricalTheme: string;
    lyrics: string;
    musicPrompt: string;
  }>;
}
