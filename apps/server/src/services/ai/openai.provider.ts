import OpenAI from 'openai';
import { AIProvider } from './ai.provider';
import { logger } from '../../config/logger';

/**
 * OpenAI Provider Implementation
 * 
 * Handles all OpenAI API interactions for text generation.
 */
export class OpenAIProvider implements AIProvider {
  private client: OpenAI | null = null;
  private model: string;
  private enabled: boolean;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    this.model = process.env.OPENAI_MODEL_TEXT || 'gpt-4o-mini';
    this.enabled = process.env.AI_ENCOURAGEMENT_ENABLED === 'true' && !!apiKey;

    if (this.enabled && apiKey) {
      this.client = new OpenAI({ apiKey });
      logger.info('OpenAI provider initialized');
    } else {
      logger.warn('OpenAI provider disabled - missing API key or feature flag');
    }
  }

  async generateEncouragement(input: {
    title?: string;
    content?: string;
    type: 'free_form' | 'question_based';
    answers?: Array<{ question: string; answer: string }>;
  }): Promise<string> {
    if (!this.enabled || !this.client) {
      // Fallback message if AI is disabled
      return '오늘 하루도 수고하셨어요. 당신의 기록이 소중합니다.';
    }

    try {
      // Build diary text content
      let diaryText = '';
      if (input.title) {
        diaryText += `제목: ${input.title}\n\n`;
      }
      if (input.content) {
        diaryText += input.content;
      }
      if (input.type === 'question_based' && input.answers && input.answers.length > 0) {
        diaryText += '\n\n';
        input.answers.forEach((qa) => {
          diaryText += `Q: ${qa.question}\nA: ${qa.answer}\n\n`;
        });
      }

      if (!diaryText.trim()) {
        return '오늘 하루도 수고하셨어요. 당신의 기록이 소중합니다.';
      }

      const prompt = `당신은 따뜻하고 공감적인 일기 응원 메시지를 작성하는 도우미입니다.

사용자의 일기 내용을 읽고, 한 문장으로 따뜻하고 공감적인 응원 메시지를 작성해주세요.

중요한 규칙:
- 요약하지 마세요
- "요약"이나 "분석"이라는 단어를 사용하지 마세요
- 과도하게 드라마틱하지 마세요
- 따뜻하고, 차분하며, 지지하는 톤을 유지하세요
- 한 문장만 출력하세요
- 1-2줄 정도로 간결하게 작성하세요
- 따옴표나 번호를 사용하지 마세요
- 이모지를 사용하지 마세요

일기 내용:
${diaryText.substring(0, 2000)}`;

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: '당신은 따뜻하고 공감적인 일기 응원 메시지를 작성하는 도우미입니다. 한 문장으로만 응답하세요.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 150,
      });

      const message = response.choices[0]?.message?.content?.trim();
      if (!message) {
        throw new Error('Empty response from OpenAI');
      }

      // Ensure it's a single sentence (take first sentence if multiple)
      const firstSentence = message.split(/[.!?]\s+/)[0].trim();
      return firstSentence || message.substring(0, 100);
    } catch (error) {
      logger.error('OpenAI encouragement generation failed', { error });
      // Return fallback message on error
      return '오늘 하루도 수고하셨어요. 당신의 기록이 소중합니다.';
    }
  }

  async analyzeForMusic(input: {
    diaries: Array<{
      id: string;
      title?: string;
      content?: string;
      date: string;
      type: 'free_form' | 'question_based';
      answers?: Array<{ question: string; answer: string }>;
    }>;
  }): Promise<{
    titleKo: string;
    titleEn: string;
    overallEmotion: string;
    mood: string;
    keywords: string[];
    lyricalTheme: string;
    lyrics: string;
    musicPrompt: string;
    }> {
    if (!this.enabled || !this.client) {
      throw new Error('OpenAI provider is not enabled');
    }

    try {
      // Combine all diary content
      let combinedText = '';
      input.diaries.forEach((diary, index) => {
        combinedText += `일기 ${index + 1} (${diary.date}):\n`;
        if (diary.title) {
          combinedText += `제목: ${diary.title}\n`;
        }
        if (diary.content) {
          combinedText += `${diary.content}\n`;
        }
        if (diary.answers && diary.answers.length > 0) {
          diary.answers.forEach((qa) => {
            combinedText += `Q: ${qa.question}\nA: ${qa.answer}\n`;
          });
        }
        combinedText += '\n';
      });

      const prompt = `다음은 사용자가 선택한 7개의 일기 내용입니다. 이 일기들을 종합적으로 분석하여 음악 생성에 필요한 정보를 제공해주세요.

일기 내용:
${combinedText.substring(0, 4000)}

다음 JSON 형식으로 정확히 응답해주세요 (JSON만 출력, 다른 텍스트 없이):
{
  "titleKo": "노래 제목 한국어 10자 이내",
  "titleEn": "English song title 20 characters max",
  "overallEmotion": "전체적인 감정 (예: nostalgic healing, peaceful reflection)",
  "mood": "분위기 (예: warm, reflective, slightly hopeful)",
  "keywords": ["키워드1", "키워드2", "키워드3", "키워드4"],
  "lyricalTheme": "가사 테마 (한국어로, 일기 내용을 바탕으로 한 주제)",
  "lyrics": "완성된 가사 (한국어, 2-3절 정도)",
  "musicPrompt": "음악 생성 프롬프트 (영어, genre, mood, tempo, instrumentation, atmosphere를 포함)"
}

musicPrompt는 영어로 작성하고, 다음 요소들을 포함해야 합니다:
- genre (장르)
- mood (분위기)
- tempo (템포)
- instrumentation (악기 구성)
- atmosphere (분위기)
- diary/reflection feeling (일기/성찰 느낌)
- 곡 길이는 약 2분 안으로 자연스럽게 마무리되도록 (natural ending, no abrupt cut) 구상

예시: "warm reflective piano pop, soft female vocal feel, nostalgic yet hopeful, slow tempo, intimate diary-like atmosphere, gentle buildup, natural ending within 2 minutes"`;

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a music analysis assistant. Always respond with valid JSON only, no additional text.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.8,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const parsed = JSON.parse(content);
      
      if (!parsed.overallEmotion || !parsed.mood || !parsed.keywords || !parsed.lyricalTheme || !parsed.lyrics || !parsed.musicPrompt) {
        throw new Error('Invalid response structure from OpenAI');
      }

      const titleKo = String(parsed.titleKo ?? parsed.title ?? parsed.lyricalTheme ?? '제목 없음').slice(0, 10);
      const titleEn = String(parsed.titleEn ?? '').slice(0, 20);

      return {
        titleKo,
        titleEn: titleEn || titleKo,
        overallEmotion: String(parsed.overallEmotion),
        mood: String(parsed.mood),
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(String) : [],
        lyricalTheme: String(parsed.lyricalTheme),
        lyrics: String(parsed.lyrics),
        musicPrompt: String(parsed.musicPrompt),
      };
    } catch (error) {
      logger.error('OpenAI music analysis failed', { error });
      throw error;
    }
  }
}

export const openAIProvider = new OpenAIProvider();
