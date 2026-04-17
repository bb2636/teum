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

  private getLanguageName(langCode: string): string {
    const map: Record<string, string> = {
      ko: 'Korean', en: 'English', ja: 'Japanese', zh: 'Chinese',
      de: 'German', es: 'Spanish', fr: 'French', it: 'Italian',
      pt: 'Portuguese', ru: 'Russian', ar: 'Arabic', vi: 'Vietnamese',
      th: 'Thai', nl: 'Dutch', sv: 'Swedish', no: 'Norwegian',
      da: 'Danish', fi: 'Finnish', pl: 'Polish', tr: 'Turkish',
      id: 'Indonesian', ms: 'Malay', tl: 'Filipino',
    };
    return map[langCode] || 'English';
  }

  async generateEncouragement(input: {
    title?: string;
    content?: string;
    type: 'free_form' | 'question_based';
    answers?: Array<{ question: string; answer: string }>;
    language?: string;
  }): Promise<string> {
    if (!this.enabled || !this.client) {
      logger.warn('OpenAI provider is disabled, returning fallback message');
      return input.language && input.language !== 'ko'
        ? 'Great job today. Your record is precious.'
        : '오늘 하루도 수고하셨어요. 당신의 기록이 소중합니다.';
    }

    try {
      logger.info('Generating encouragement', { 
        type: input.type, 
        hasAnswers: !!input.answers, 
        answersCount: input.answers?.length || 0 
      });

      const lang = input.language || 'ko';
      const langName = this.getLanguageName(lang);
      const isKo = lang === 'ko';

      let diaryText = '';
      if (input.title) {
        diaryText += isKo ? `제목: ${input.title}\n\n` : `Title: ${input.title}\n\n`;
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
        
        const validAnswers = input.answers.filter(qa => qa.answer?.trim());
        if (validAnswers.length === 0) {
          logger.warn('No valid answers found for question-based diary');
          return isKo
            ? '오늘 하루도 수고하셨어요. 당신의 기록이 소중합니다.'
            : 'Great job today. Your record is precious.';
        }
        
        diaryText += isKo ? '\n\n=== 질문과 답변 ===\n\n' : '\n\n=== Questions & Answers ===\n\n';
        validAnswers.forEach((qa, index) => {
          if (qa.question?.trim()) {
            diaryText += isKo
              ? `질문 ${index + 1}: ${qa.question}\n답변: ${qa.answer}\n\n`
              : `Q${index + 1}: ${qa.question}\nA: ${qa.answer}\n\n`;
          } else {
            diaryText += isKo
              ? `답변 ${index + 1}: ${qa.answer}\n\n`
              : `Answer ${index + 1}: ${qa.answer}\n\n`;
          }
        });

        if (!diaryText.trim()) {
          logger.warn('Diary text is empty after processing answers');
          return isKo
            ? '오늘 하루도 수고하셨어요. 당신의 기록이 소중합니다.'
            : 'Great job today. Your record is precious.';
        }
        
        logger.info('Diary text prepared for AI', { 
          textLength: diaryText.length,
          preview: diaryText.substring(0, 200),
        });

        if (isKo) {
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
          prompt = `You are a warm and empathetic diary encouragement message writer.

Read the user's diary where they answered several questions. Deeply understand the emotions and content in each answer, then write a single warm, empathetic encouragement message in ${langName}.

Important rules:
- Analyze each answer individually and understand them comprehensively
- Accurately identify the specific emotions, experiences, and thoughts revealed in the answers
- Even if the answers are short, deeply read the meaning and emotions within them
- Even if the content seems simple, understand and empathize with the user's sincere heart
- Do NOT summarize
- Do NOT use words like "summary" or "analysis"
- Do NOT be overly dramatic
- Maintain a warm, calm, and supportive tone
- Output only ONE sentence
- Keep it concise, about 1-2 lines
- Do NOT use quotation marks or numbering
- Do NOT use emojis
- Write a message that empathizes with the emotions and experiences felt in the user's answers
- Write each message with different expressions and perspectives (do not repeat)
- Mention specific content or express empathy for it
- Write a personalized message specific to this diary rather than generic encouragement
- You MUST write your response in ${langName}

Diary content:
${diaryText.substring(0, 2000)}`;
        }
      } else {
        if (!diaryText.trim()) {
          return isKo
            ? '오늘 하루도 수고하셨어요. 당신의 기록이 소중합니다.'
            : 'Great job today. Your record is precious.';
        }

        if (isKo) {
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
        } else {
          prompt = `You are a warm and empathetic diary encouragement message writer.

Read the user's diary and write a single warm, empathetic encouragement message in ${langName}.

Important rules:
- Accurately identify the specific emotions, experiences, and thoughts in the diary
- Even if the content is short, deeply read the meaning and emotions within it
- Even if the content seems simple, understand and empathize with the user's sincere heart
- Do NOT summarize
- Do NOT use words like "summary" or "analysis"
- Do NOT be overly dramatic
- Maintain a warm, calm, and supportive tone
- Output only ONE sentence
- Keep it concise, about 1-2 lines
- Do NOT use quotation marks or numbering
- Do NOT use emojis
- Write each message with different expressions and perspectives (do not repeat)
- Mention specific content or express empathy for it
- Write a personalized message specific to this diary rather than generic encouragement
- You MUST write your response in ${langName}

Diary content:
${diaryText.substring(0, 2000)}`;
        }
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
      
      const systemContent = isKo
        ? '당신은 따뜻하고 공감적인 일기 응원 메시지를 작성하는 도우미입니다. 매번 다른 관점과 표현으로 개인화된 메시지를 한 문장으로 작성하세요. 반복하지 마세요.'
        : `You are a warm and empathetic diary encouragement message writer. Write a personalized message in one sentence with different perspectives and expressions each time. Do not repeat. Always respond in ${langName}.`;

      let response;
      try {
        response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: systemContent,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.9,
          max_tokens: 200,
        });
      } catch (apiError: unknown) {
        const err = apiError as Record<string, unknown>;
        const errorInfo: Record<string, unknown> = {
          errorMessage: apiError instanceof Error ? apiError.message : String(apiError),
          errorName: apiError instanceof Error ? apiError.name : undefined,
          model: this.model,
          promptLength: prompt.length,
        };

        if (err?.code) errorInfo.errorCode = err.code;
        if (err?.status) errorInfo.errorStatus = err.status;
        if (err?.statusText) errorInfo.errorStatusText = err.statusText;
        if (err?.type) errorInfo.errorType = err.type;
        
        // response 객체가 있는 경우
        if (err?.response) {
          try {
            errorInfo.errorResponse = typeof err.response === 'string' 
              ? err.response 
              : JSON.stringify(err.response, null, 2);
          } catch (e) {
            errorInfo.errorResponse = 'Failed to stringify response';
          }
        }

        // error 객체의 모든 속성 로깅
        if (apiError && typeof apiError === 'object') {
          Object.keys(apiError as object).forEach((key) => {
            if (!errorInfo[key] && !key.startsWith('_')) {
              try {
                const value = (apiError as Record<string, unknown>)[key];
                if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                  errorInfo[`error_${key}`] = value;
                } else if (value === null || value === undefined) {
                  errorInfo[`error_${key}`] = value;
                } else {
                  errorInfo[`error_${key}`] = JSON.stringify(value).substring(0, 500);
                }
              } catch (e) {
                errorInfo[`error_${key}`] = String((apiError as Record<string, unknown>)[key]).substring(0, 500);
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
    } catch (error: unknown) {
      const err = error as Record<string, unknown>;
      const errorDetails: Record<string, unknown> = {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : undefined,
        errorCode: err?.code,
        errorStatus: err?.status,
        errorStatusText: err?.statusText,
        errorType: err?.type,
        inputType: input.type,
        hasContent: !!input.content,
        contentLength: input.content?.length || 0,
        hasAnswers: !!input.answers,
        answersCount: input.answers?.length || 0,
      };

      if (err?.response) {
        try {
          const resp = err.response as Record<string, unknown>;
          errorDetails.openAIResponse = JSON.stringify(resp.data || resp);
        } catch (e) {
          errorDetails.openAIResponse = 'Failed to stringify response';
        }
      }

      if (error && typeof error === 'object') {
        Object.keys(error as object).forEach((key) => {
          if (!errorDetails[key] && key !== 'stack') {
            try {
              errorDetails[`error_${key}`] = JSON.stringify((error as Record<string, unknown>)[key]);
            } catch (e) {
              errorDetails[`error_${key}`] = String((error as Record<string, unknown>)[key]);
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

  async generateTitleSuggestions(input: {
    content?: string;
    type: 'free_form' | 'question_based';
    answers?: Array<{ question: string; answer: string }>;
    language?: string;
    count?: number;
  }): Promise<string[]> {
    if (!this.enabled || !this.client) {
      return [];
    }

    try {
      const lang = input.language || 'ko';
      const langName = this.getLanguageName(lang);
      const isKo = lang === 'ko';
      const count = Math.min(Math.max(input.count ?? 3, 1), 5);

      let diaryText = '';
      if (input.content) diaryText += input.content;
      if (input.type === 'question_based' && input.answers && input.answers.length > 0) {
        const validAnswers = input.answers.filter((qa) => qa.answer?.trim());
        validAnswers.forEach((qa, index) => {
          if (qa.question?.trim()) {
            diaryText += isKo
              ? `\n질문 ${index + 1}: ${qa.question}\n답변: ${qa.answer}\n`
              : `\nQ${index + 1}: ${qa.question}\nA: ${qa.answer}\n`;
          } else {
            diaryText += isKo
              ? `\n답변 ${index + 1}: ${qa.answer}\n`
              : `\nAnswer ${index + 1}: ${qa.answer}\n`;
          }
        });
      }

      if (!diaryText.trim()) return [];

      const prompt = isKo
        ? `다음 일기 내용을 보고 어울리는 제목 후보 ${count}개를 제안해줘.

규칙:
- 한국어로 작성
- 각 제목은 6~16자 사이의 짧은 문구
- 따옴표, 마침표, 이모지 사용 금지
- 서로 다른 관점이나 분위기를 담을 것 (감정 중심 / 장면 중심 / 비유 중심 등)
- 일기처럼 잔잔하고 사적인 톤
- 번호나 접두어 없이, 한 줄에 하나씩, 총 ${count}줄만 출력

일기:
${diaryText.substring(0, 1500)}`
        : `Read the diary below and suggest ${count} possible titles.

Rules:
- Write in ${langName}
- Each title is short (about 3-7 words)
- No quotes, periods, or emojis
- Each title takes a different angle (emotion / scene / metaphor)
- Calm, personal diary-like tone
- Output exactly ${count} lines, one title per line, no numbering or prefixes

Diary:
${diaryText.substring(0, 1500)}`;

      const systemMsg = isKo
        ? '일기에 어울리는 짧은 제목 후보들을 제안하는 도우미. 매번 서로 다른 관점의 제목을 만든다.'
        : `A helper that suggests short title candidates for a diary, each from a different angle. Always respond in ${langName}.`;

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemMsg },
          { role: 'user', content: prompt },
        ],
        temperature: 0.95,
        max_tokens: 200,
      });

      const raw = response.choices[0]?.message?.content?.trim() || '';
      const lines = raw
        .split('\n')
        .map((line) =>
          line
            .replace(/^\s*[-*•]\s*/, '')
            .replace(/^\s*\d+[.)]\s*/, '')
            .replace(/^["'`「『]+|["'`」』]+$/g, '')
            .replace(/^제목\s*[:：]\s*/i, '')
            .replace(/^Title\s*[:：]\s*/i, '')
            .replace(/[.。!！?？]+$/g, '')
            .trim()
        )
        .filter((line) => line.length > 0 && line.length <= 100);

      const unique = Array.from(new Set(lines));
      return unique.slice(0, count);
    } catch (error) {
      logger.error('OpenAI title suggestions failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  async generateTitle(input: {
    content?: string;
    type: 'free_form' | 'question_based';
    answers?: Array<{ question: string; answer: string }>;
    language?: string;
  }): Promise<string> {
    if (!this.enabled || !this.client) {
      return '';
    }

    try {
      const lang = input.language || 'ko';
      const langName = this.getLanguageName(lang);
      const isKo = lang === 'ko';

      let diaryText = '';
      if (input.content) {
        diaryText += input.content;
      }
      if (input.type === 'question_based' && input.answers && input.answers.length > 0) {
        const validAnswers = input.answers.filter((qa) => qa.answer?.trim());
        validAnswers.forEach((qa, index) => {
          if (qa.question?.trim()) {
            diaryText += isKo
              ? `\n질문 ${index + 1}: ${qa.question}\n답변: ${qa.answer}\n`
              : `\nQ${index + 1}: ${qa.question}\nA: ${qa.answer}\n`;
          } else {
            diaryText += isKo
              ? `\n답변 ${index + 1}: ${qa.answer}\n`
              : `\nAnswer ${index + 1}: ${qa.answer}\n`;
          }
        });
      }

      if (!diaryText.trim()) {
        return '';
      }

      const prompt = isKo
        ? `다음 일기 내용을 보고 짧고 인상적인 제목 한 줄을 만들어줘.

규칙:
- 한국어로 작성
- 6~16자 사이의 짧은 제목
- 따옴표, 마침표, 이모지 사용 금지
- "제목:" 같은 접두어 사용 금지
- 핵심 감정이나 장면을 한 줄로 압축
- 일기처럼 잔잔하고 사적인 톤

일기:
${diaryText.substring(0, 1500)}`
        : `Read the following diary and create one short, evocative title.

Rules:
- Write in ${langName}
- Keep it short (about 3-7 words)
- Do NOT use quotes, periods, or emojis
- Do NOT prefix with "Title:" or similar
- Capture the core emotion or scene in one line
- Keep a calm, personal diary-like tone

Diary:
${diaryText.substring(0, 1500)}`;

      const systemMsg = isKo
        ? '일기에 어울리는 짧고 시적인 제목 한 줄을 만드는 도우미.'
        : `A helper that crafts one short, poetic title for a diary entry. Always respond in ${langName}.`;

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemMsg },
          { role: 'user', content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 40,
      });

      const raw = response.choices[0]?.message?.content?.trim() || '';
      const cleaned = raw
        .replace(/^["'`「『]+|["'`」』]+$/g, '')
        .replace(/^제목\s*[:：]\s*/i, '')
        .replace(/^Title\s*[:：]\s*/i, '')
        .replace(/[.。!！?？]+$/g, '')
        .split('\n')[0]
        .trim();

      return cleaned;
    } catch (error) {
      logger.error('OpenAI title generation failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return '';
    }
  }

  async generateSummary(input: {
    title?: string;
    content?: string;
    type: 'free_form' | 'question_based';
    answers?: Array<{ question: string; answer: string }>;
    language?: string;
  }): Promise<string> {
    if (!this.enabled || !this.client) {
      return '';
    }

    try {
      const lang = input.language || 'ko';
      const langName = this.getLanguageName(lang);
      const isKo = lang === 'ko';

      let diaryText = '';
      if (input.title) {
        diaryText += isKo ? `제목: ${input.title}\n\n` : `Title: ${input.title}\n\n`;
      }
      if (input.content) {
        diaryText += input.content;
      }

      let isQuestionBased = false;
      if (input.type === 'question_based' && input.answers && input.answers.length > 0) {
        isQuestionBased = true;
        diaryText = '';
        if (input.title) {
          diaryText += isKo ? `제목: ${input.title}\n\n` : `Title: ${input.title}\n\n`;
        }
        input.answers.forEach((qa, index) => {
          if (qa.question) {
            diaryText += isKo
              ? `질문: ${qa.question}\n답변: ${qa.answer}\n\n`
              : `Q: ${qa.question}\nA: ${qa.answer}\n\n`;
          } else {
            diaryText += isKo
              ? `답변 ${index + 1}: ${qa.answer}\n\n`
              : `Answer ${index + 1}: ${qa.answer}\n\n`;
          }
        });
      }

      if (!diaryText.trim()) return '';

      let summaryPrompt: string;
      let systemMsg: string;

      if (isKo) {
        const questionBasedRules = isQuestionBased
          ? `- 질문과 답변을 하나의 흐름으로 연결하여 요약 (질문 내용도 반영)\n`
          : '';
        summaryPrompt = `아래 일기를 1-2줄로 짧게 요약해줘.

규칙:
- 핵심 감정과 상황만 간결하게
- 담담한 서술형 톤 ("~했다", "~느꼈다")
- "사용자"라는 단어 절대 쓰지 않기
- 이모지 쓰지 않기
- 최대 2문장
${questionBasedRules}
일기:
${diaryText.substring(0, 2000)}`;
        systemMsg = '일기 내용을 1-2문장으로 짧게 요약하는 도우미. "사용자"라는 단어는 절대 쓰지 않는다.';
      } else {
        const questionBasedRules = isQuestionBased
          ? `- Connect the questions and answers into a single flow for the summary (reflect the question content too)\n`
          : '';
        summaryPrompt = `Briefly summarize the diary below in 1-2 lines in ${langName}.

Rules:
- Only the core emotions and situations, concisely
- Calm, narrative tone
- NEVER use the word "user"
- Do NOT use emojis
- Maximum 2 sentences
- You MUST write in ${langName}
${questionBasedRules}
Diary:
${diaryText.substring(0, 2000)}`;
        systemMsg = `A diary summarizer that writes brief 1-2 sentence summaries. Never use the word "user". Always respond in ${langName}.`;
      }

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: systemMsg,
          },
          {
            role: 'user',
            content: summaryPrompt,
          },
        ],
        temperature: 0.5,
        max_tokens: 200,
      });

      const message = response.choices[0]?.message?.content?.trim();
      return message || '';
    } catch (error) {
      logger.error('OpenAI summary generation failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return '';
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
    genreTag?: string;
    language?: string;
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
      const lang = input.language || 'ko';
      const isKo = lang === 'ko';

      let combinedText = '';
      input.diaries.forEach((diary, index) => {
        combinedText += isKo ? `일기 ${index + 1} (${diary.date}):\n` : `Diary ${index + 1} (${diary.date}):\n`;
        if (diary.title) {
          combinedText += isKo ? `제목: ${diary.title}\n` : `Title: ${diary.title}\n`;
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

      const genreInstructionKo = input.genreTag?.trim()
        ? `\n\n중요: 사용자가 선택한 장르는 "${input.genreTag}"입니다. musicPrompt와 가사 스타일을 반드시 이 장르에 맞게 작성하세요. 여러 장르가 선택된 경우 자연스럽게 융합(blend)하여 하나의 통일된 스타일로 만들어주세요. 예를 들어 "rock, ballad"이면 록 발라드 스타일로, "indie, electronic"이면 인디 일렉트로닉 스타일로 작성하세요. 서로 상반되는 장르라도 창의적으로 조합하세요.`
        : '';

      const genreInstructionEn = input.genreTag?.trim()
        ? `\n\nImportant: The user selected genre "${input.genreTag}". The musicPrompt and lyric style MUST match this genre. If multiple genres are selected, blend them naturally into one unified style. For example, "rock, ballad" becomes rock ballad style, "indie, electronic" becomes indie electronic style. Even contrasting genres should be creatively combined.`
        : '';

      let prompt: string;

      if (isKo) {
        prompt = `다음은 사용자가 선택한 7개의 일기 내용입니다. 이 일기들을 종합적으로 분석하여 음악 생성에 필요한 정보를 제공해주세요.${genreInstructionKo}

일기 내용:
${combinedText.substring(0, 4000)}

가사 언어 규칙:
- 먼저 일기 7개의 내용을 전체적으로 분석하여 어떤 언어로 주로 작성되었는지 파악하세요.
- 일기가 전부 한국어면 → 가사를 한국어로 작성
- 일기가 전부 영어면 → 가사를 영어로 작성
- 한국어와 영어가 섞여 있으면 → 일기 내용의 분위기와 핵심 감정을 살려서 한국어와 영어를 자연스럽게 믹스한 가사를 작성. 예를 들어 한 문단은 한국어, 다음 문단은 영어 식으로 교차하거나, 한 줄 안에서 자연스럽게 섞어도 좋습니다. 영어 비중이 많으면 영어 위주로, 한국어 비중이 많으면 한국어 위주로 가사를 작성하되, 소수 언어도 자연스럽게 포함하세요.
- 장르에 따라 가사 언어와 스타일을 자연스럽게 조절하세요. 예를 들어 hip-hop 장르에서는 영어 표현이나 라임을 섞을 수 있고, 발라드에서는 일기 언어에 충실할 수 있습니다. 장르의 특성을 살리되, 일기 내용의 감정이 잘 전달되도록 균형을 맞추세요.
- lyricalTheme과 keywords도 가사 언어에 맞춰 작성하세요.

다음 JSON 형식으로 정확히 응답해주세요 (JSON만 출력, 다른 텍스트 없이):
{
  "titleKo": "노래 제목 한국어 10자 이내",
  "titleEn": "English song title 20 characters max",
  "overallEmotion": "전체적인 감정 (예: nostalgic healing, peaceful reflection)",
  "mood": "분위기 (예: warm, reflective, slightly hopeful)",
  "keywords": ["키워드1", "키워드2", "키워드3", "키워드4"],
  "lyricalTheme": "가사 테마 (일기 내용을 바탕으로 한 주제)",
  "lyrics": "완성된 가사 (정확히 5문단, 각 문단 정확히 3줄, 문단 사이 빈 줄로 구분). 반드시 일기 원문을 그대로 인용하지 말고, 일기에서 느껴지는 감정·상황·분위기를 바탕으로 완전히 새롭게 시적이고 음악적으로 재구성할 것. 원문의 문장 구조나 표현을 직접적으로 옮기지 말고, 감정의 핵심만 추출하여 노래 가사에 맞게 창작할 것. 은유, 비유, 감성적 표현을 풍부하게 사용할 것. 중요: 일기에 부정적이거나 우울한 내용이 있더라도 가사는 반드시 희망적이고 위로가 되는 방향으로 승화시킬 것. 슬픔을 인정하되 극복과 치유의 메시지를 담을 것. 쉼표(,) 사용 규칙: 줄 끝에 쉼표를 절대 넣지 말 것. 쉼표는 한 줄 안에서 나열이나 대등절을 연결할 때만 사용하고, 줄의 마지막 단어 뒤에는 쉼표 없이 끝낼 것.",
  "musicPrompt": "음악 생성 프롬프트 (영어, genre, mood, tempo, instrumentation, atmosphere를 포함)${input.genreTag?.trim() ? ` — 반드시 ${input.genreTag} 장르를 기반으로 작성` : ''}"
}

musicPrompt는 영어로 작성하고, 다음 요소들을 포함해야 합니다:
- genre (장르)${input.genreTag?.trim() ? ` — 사용자가 선택한 "${input.genreTag}"를 반드시 반영` : ''}
- mood (분위기)
- tempo (템포)
- instrumentation (악기 구성) — 선택된 장르에 맞는 악기 구성
- atmosphere (분위기)
- diary/reflection feeling (일기/성찰 느낌)
- 곡 길이는 약 2분 안으로 자연스럽게 마무리되도록 (natural ending, no abrupt cut) 구상

예시: "warm reflective piano pop, soft female vocal feel, nostalgic yet hopeful, slow tempo, intimate diary-like atmosphere, gentle buildup, natural ending within 2 minutes"`;
      } else {
        prompt = `Below are 7 diary entries selected by the user. Analyze them comprehensively and provide the information needed for music generation.${genreInstructionEn}

Diary content:
${combinedText.substring(0, 4000)}

Lyrics language rules:
- First, analyze all 7 diary entries to determine the primary language(s) used.
- If all diaries are in Korean → write lyrics in Korean
- If all diaries are in English → write lyrics in English
- If diaries contain a mix of Korean and English → write lyrics that naturally blend both languages, reflecting the diary content's mood and core emotions. For example, alternate stanzas between languages, or naturally mix within lines. If English is dominant, lean English-heavy; if Korean is dominant, lean Korean-heavy — but include the minority language naturally.
- Adjust lyrics language and style naturally based on the genre. For example, hip-hop genres may incorporate English expressions or rhymes, while ballads may stay closer to the diary language. Balance the genre's characteristics with effectively conveying the diary's emotions.
- lyricalTheme and keywords should match the lyrics language.

Respond with EXACTLY the following JSON format (JSON only, no other text):
{
  "titleKo": "Song title in Korean, max 10 characters",
  "titleEn": "English song title, max 20 characters",
  "overallEmotion": "Overall emotion (e.g. nostalgic healing, peaceful reflection)",
  "mood": "Mood (e.g. warm, reflective, slightly hopeful)",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4"],
  "lyricalTheme": "Lyrical theme based on diary content",
  "lyrics": "Complete lyrics, exactly 5 stanzas, each stanza exactly 3 lines, separated by blank lines between stanzas. Do NOT quote diary text directly — instead, extract the core emotions, situations, and atmosphere from the diaries and creatively reimagine them as poetic, musical lyrics. Use metaphors, imagery, and evocative expressions. Important: Even if diary content is negative or melancholy, the lyrics MUST be uplifting and comforting — acknowledge sadness but transform it into a message of healing and hope. Comma rule: NEVER end a line with a comma. Commas should only be used mid-line for lists or connecting clauses.",
  "musicPrompt": "Music generation prompt in English including genre, mood, tempo, instrumentation, atmosphere${input.genreTag?.trim() ? ` — MUST be based on ${input.genreTag} genre` : ''}"
}

musicPrompt must be in English and include:
- genre${input.genreTag?.trim() ? ` — must reflect user's selected "${input.genreTag}"` : ''}
- mood
- tempo
- instrumentation — matching the selected genre
- atmosphere
- diary/reflection feeling
- song should naturally wrap up within about 2 minutes (natural ending, no abrupt cut)

Example: "warm reflective piano pop, soft female vocal feel, nostalgic yet hopeful, slow tempo, intimate diary-like atmosphere, gentle buildup, natural ending within 2 minutes"`;
      }

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

      let lyricsText = String(parsed.lyrics);
      lyricsText = lyricsText.replace(/\\n/g, '\n');

      return {
        titleKo,
        titleEn: titleEn || titleKo,
        overallEmotion: String(parsed.overallEmotion),
        mood: String(parsed.mood),
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(String) : [],
        lyricalTheme: String(parsed.lyricalTheme),
        lyrics: lyricsText,
        musicPrompt: String(parsed.musicPrompt),
      };
    } catch (error) {
      logger.error('OpenAI music analysis failed', { error });
      throw error;
    }
  }

  async translateTerms(input: {
    title: string;
    content: string;
    lang: string;
  }): Promise<{ title: string; content: string }> {
    if (!this.client) {
      return { title: input.title, content: input.content };
    }

    try {
      const langName = this.getLanguageName(input.lang);
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are a professional legal document translator. Translate the given Korean terms/policy document into ${langName}. Maintain the exact same structure, formatting, line breaks, and numbering. Do not add or remove content. Output valid JSON with "title" and "content" fields.`,
          },
          {
            role: 'user',
            content: JSON.stringify({ title: input.title, content: input.content }),
          },
        ],
        temperature: 0.2,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      });

      const result = response.choices[0]?.message?.content;
      if (!result) return { title: input.title, content: input.content };

      const parsed = JSON.parse(result);
      return {
        title: parsed.title || input.title,
        content: parsed.content || input.content,
      };
    } catch (error) {
      logger.error('Terms translation failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { title: input.title, content: input.content };
    }
  }
}

export const openAIProvider = new OpenAIProvider();
