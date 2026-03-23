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
    const aiIntegrationsKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    const aiIntegrationsBaseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    const legacyApiKey = process.env.OPENAI_API_KEY;
    const legacyBaseURL = process.env.OPENAI_BASE_URL;

    const useIntegrations = !!aiIntegrationsKey;
    const apiKey = useIntegrations ? aiIntegrationsKey : legacyApiKey;
    const baseURL = useIntegrations ? aiIntegrationsBaseURL : legacyBaseURL;

    this.model = process.env.OPENAI_MODEL_TEXT || 'gpt-4o-mini';
    const encouragementEnabled = process.env.AI_ENCOURAGEMENT_ENABLED === 'true';
    this.enabled = encouragementEnabled && !!apiKey;

    logger.info('OpenAI provider initialization', {
      hasApiKey: !!apiKey,
      hasBaseURL: !!baseURL,
      useAIIntegrations: !!aiIntegrationsKey,
      encouragementEnabled,
      enabled: this.enabled,
      model: this.model,
    });

    if (this.enabled && apiKey) {
      this.client = new OpenAI({
        apiKey,
        ...(baseURL ? { baseURL } : {}),
      });
      logger.info('OpenAI provider initialized successfully');
    } else {
      logger.warn('OpenAI provider disabled', {
        reason: !apiKey ? 'missing API key' : 'feature flag disabled',
        encouragementEnabled,
        hasApiKey: !!apiKey,
      });
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
      logger.warn('OpenAI provider is disabled, returning fallback message');
      return '오늘 하루도 수고하셨어요. 당신의 기록이 소중합니다.';
    }

    try {
      logger.info('Generating encouragement', { 
        type: input.type, 
        hasAnswers: !!input.answers, 
        answersCount: input.answers?.length || 0 
      });

      // Build diary text content
      let diaryText = '';
      if (input.title) {
        diaryText += `제목: ${input.title}\n\n`;
      }
      if (input.content) {
        diaryText += input.content;
      }
      
      let prompt = '';
      if (input.type === 'question_based' && input.answers && input.answers.length > 0) {
        logger.info('Processing question-based diary', { 
          answersCount: input.answers.length,
          questionsWithText: input.answers.filter(qa => qa.question?.trim()).length,
        });
        
        // 질문형식일 때는 각 질문과 답변을 더 자세히 분석
        // 질문이 없는 경우도 있으므로 답변만으로도 분석 가능하도록 처리
        const validAnswers = input.answers.filter(qa => qa.answer?.trim());
        if (validAnswers.length === 0) {
          logger.warn('No valid answers found for question-based diary');
          return '오늘 하루도 수고하셨어요. 당신의 기록이 소중합니다.';
        }
        
        diaryText += '\n\n=== 질문과 답변 ===\n\n';
        validAnswers.forEach((qa, index) => {
          if (qa.question?.trim()) {
            diaryText += `질문 ${index + 1}: ${qa.question}\n답변: ${qa.answer}\n\n`;
          } else {
            // 질문이 없어도 답변만으로 분석 가능하도록
            diaryText += `답변 ${index + 1}: ${qa.answer}\n\n`;
          }
        });

        if (!diaryText.trim()) {
          logger.warn('Diary text is empty after processing answers');
          return '오늘 하루도 수고하셨어요. 당신의 기록이 소중합니다.';
        }
        
        logger.info('Diary text prepared for AI', { 
          textLength: diaryText.length,
          preview: diaryText.substring(0, 200),
        });

        prompt = `당신은 따뜻하고 공감적인 일기 응원 메시지를 작성하는 도우미입니다.

사용자가 여러 질문에 답변한 일기 내용을 읽고, 각 질문에 대한 답변의 감정과 내용을 깊이 있게 이해한 후, 한 문장으로 따뜻하고 공감적인 응원 메시지를 작성해주세요.

중요한 규칙:
- 각 질문에 대한 답변을 개별적으로 분석하고 종합적으로 이해하세요
- 답변에서 드러나는 구체적인 감정, 경험, 생각을 정확히 파악하세요
- 답변이 짧아도 상관없이 그 안에 담긴 의미와 감정을 깊이 있게 읽어내세요
- 내용이 단순해 보여도 사용자의 진솔한 마음을 이해하고 공감하세요
- 요약하지 마세요
- "요약"이나 "분석"이라는 단어를 사용하지 마세요
- 과도하게 드라마틱하지 마세요
- 따뜻하고, 차분하며, 지지하는 톤을 유지하세요
- 한 문장만 출력하세요
- 1-2줄 정도로 간결하게 작성하세요
- 따옴표나 번호를 사용하지 마세요
- 이모지를 사용하지 마세요
- 사용자의 답변에서 느껴지는 감정과 경험에 공감하며 응원하는 메시지를 작성하세요
- 매번 다른 표현과 관점으로 메시지를 작성하세요 (반복하지 마세요)
- 구체적인 내용을 언급하거나 그에 대한 공감을 표현하세요
- 일반적인 격려보다는 이 일기에 특화된 개인적인 메시지를 작성하세요

일기 내용:
${diaryText.substring(0, 2000)}`;
      } else {
        // 자유형식일 때는 기존 로직
        if (!diaryText.trim()) {
          return '오늘 하루도 수고하셨어요. 당신의 기록이 소중합니다.';
        }

        prompt = `당신은 따뜻하고 공감적인 일기 응원 메시지를 작성하는 도우미입니다.

사용자의 일기 내용을 읽고, 한 문장으로 따뜻하고 공감적인 응원 메시지를 작성해주세요.

중요한 규칙:
- 일기 내용에서 드러나는 구체적인 감정, 경험, 생각을 정확히 파악하세요
- 내용이 짧아도 상관없이 그 안에 담긴 의미와 감정을 깊이 있게 읽어내세요
- 내용이 단순해 보여도 사용자의 진솔한 마음을 이해하고 공감하세요
- 요약하지 마세요
- "요약"이나 "분석"이라는 단어를 사용하지 마세요
- 과도하게 드라마틱하지 마세요
- 따뜻하고, 차분하며, 지지하는 톤을 유지하세요
- 한 문장만 출력하세요
- 1-2줄 정도로 간결하게 작성하세요
- 따옴표나 번호를 사용하지 마세요
- 이모지를 사용하지 마세요
- 매번 다른 표현과 관점으로 메시지를 작성하세요 (반복하지 마세요)
- 구체적인 내용을 언급하거나 그에 대한 공감을 표현하세요
- 일반적인 격려보다는 이 일기에 특화된 개인적인 메시지를 작성하세요

일기 내용:
${diaryText.substring(0, 2000)}`;
      }

      logger.info('Sending request to OpenAI', { 
        model: this.model, 
        promptLength: prompt.length,
        promptPreview: prompt.substring(0, 200),
        hasApiKey: !!this.client,
      });
      
      if (!this.client) {
        const error = new Error('OpenAI client is not initialized');
        logger.error('OpenAI client not initialized', {
          enabled: this.enabled,
          hasClient: !!this.client,
        });
        throw error;
      }
      
      let response;
      try {
        response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: '당신은 따뜻하고 공감적인 일기 응원 메시지를 작성하는 도우미입니다. 매번 다른 관점과 표현으로 개인화된 메시지를 한 문장으로 작성하세요. 반복하지 마세요.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.9,
          max_tokens: 200,
        });
      } catch (apiError: any) {
        // OpenAI SDK 에러는 구조가 다를 수 있음
        const errorInfo: Record<string, any> = {
          errorMessage: apiError instanceof Error ? apiError.message : String(apiError),
          errorName: apiError instanceof Error ? apiError.name : undefined,
          model: this.model,
          promptLength: prompt.length,
        };

        // OpenAI SDK 에러 속성들
        if (apiError?.code) errorInfo.errorCode = apiError.code;
        if (apiError?.status) errorInfo.errorStatus = apiError.status;
        if (apiError?.statusText) errorInfo.errorStatusText = apiError.statusText;
        if (apiError?.type) errorInfo.errorType = apiError.type;
        
        // response 객체가 있는 경우
        if (apiError?.response) {
          try {
            errorInfo.errorResponse = typeof apiError.response === 'string' 
              ? apiError.response 
              : JSON.stringify(apiError.response, null, 2);
          } catch (e) {
            errorInfo.errorResponse = 'Failed to stringify response';
          }
        }

        // error 객체의 모든 속성 로깅
        if (apiError && typeof apiError === 'object') {
          Object.keys(apiError).forEach((key) => {
            if (!errorInfo[key] && !key.startsWith('_')) {
              try {
                const value = apiError[key];
                if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                  errorInfo[`error_${key}`] = value;
                } else if (value === null || value === undefined) {
                  errorInfo[`error_${key}`] = value;
                } else {
                  errorInfo[`error_${key}`] = JSON.stringify(value).substring(0, 500);
                }
              } catch (e) {
                errorInfo[`error_${key}`] = String(apiError[key]).substring(0, 500);
              }
            }
          });
        }

        logger.error('OpenAI API call failed', errorInfo);
        throw apiError;
      }

      logger.info('Received response from OpenAI', { 
        hasResponse: !!response, 
        choicesCount: response.choices?.length || 0 
      });

      const message = response.choices[0]?.message?.content?.trim();
      if (!message) {
        logger.error('Empty message from OpenAI response', { response });
        throw new Error('Empty response from OpenAI');
      }

      logger.info('Successfully generated encouragement message', { messageLength: message.length });

      // Ensure it's a single sentence (take first sentence if multiple)
      const firstSentence = message.split(/[.!?]\s+/)[0].trim();
      const finalMessage = firstSentence || message.substring(0, 100);
      logger.info('Final encouragement message', { finalMessage });
      return finalMessage;
    } catch (error: any) {
      // 더 상세한 에러 로깅
      const errorDetails: Record<string, any> = {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : undefined,
        errorCode: error?.code,
        errorStatus: error?.status,
        errorStatusText: error?.statusText,
        errorType: error?.type,
        inputType: input.type,
        hasContent: !!input.content,
        contentLength: input.content?.length || 0,
        hasAnswers: !!input.answers,
        answersCount: input.answers?.length || 0,
      };

      // OpenAI API 에러인 경우 추가 정보
      if (error?.response) {
        try {
          errorDetails.openAIResponse = JSON.stringify(error.response.data || error.response);
        } catch (e) {
          errorDetails.openAIResponse = 'Failed to stringify response';
        }
      }

      // 에러 객체의 모든 속성 로깅
      if (error && typeof error === 'object') {
        Object.keys(error).forEach((key) => {
          if (!errorDetails[key] && key !== 'stack') {
            try {
              errorDetails[`error_${key}`] = JSON.stringify(error[key]);
            } catch (e) {
              errorDetails[`error_${key}`] = String(error[key]);
            }
          }
        });
      }

      if (error instanceof Error && error.stack) {
        errorDetails.stack = error.stack;
      }

      logger.error('OpenAI encouragement generation failed', errorDetails);
      
      // Don't return fallback message - let the error propagate so it's not saved
      throw error;
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
  "lyrics": "완성된 가사 (한국어, 2분 분량에 맞게 최소 5문단 ~ 최대 10문단, 각 문단 3-4줄, 문단 사이 빈 줄로 구분). 반드시 일기 원문을 그대로 인용하지 말고, 일기에서 느껴지는 감정·상황·분위기를 바탕으로 시적이고 음악적으로 재구성할 것. 노래 가사답게 은유, 비유, 감성적 표현을 사용하여 공감할 수 있는 가사를 작성할 것",
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
        max_tokens: 4000,
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
