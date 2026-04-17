import { db } from '../db';
import { questionTranslations } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../config/logger';
import crypto from 'crypto';

function hashText(text: string): string {
  return crypto.createHash('md5').update(text).digest('hex');
}

async function translateWithAI(texts: string[], targetLang: string): Promise<string[]> {
  const langName = targetLang === 'en' ? 'English' : targetLang === 'ko' ? 'Korean' : targetLang;

  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

  if (!apiKey) {
    logger.warn('No OpenAI API key for translation');
    return texts;
  }

  const prompt = `Translate the following Korean diary prompts/questions to ${langName}. Keep them natural and conversational. Return ONLY a JSON array of translated strings in the same order.\n\n${JSON.stringify(texts)}`;

  const response = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL_TEXT || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
  });

  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content?.trim() || '';

  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    logger.error({ content }, 'Failed to parse translation response');
    return texts;
  }

  const translated = JSON.parse(jsonMatch[0]) as string[];
  if (translated.length !== texts.length) {
    logger.error('Translation count mismatch');
    return texts;
  }

  return translated;
}

export async function getTranslatedQuestions(
  questions: { id: string; question: string }[],
  lang: string
): Promise<{ id: string; question: string }[]> {
  if (lang === 'ko' || !lang) {
    return questions;
  }

  const needTranslation: { index: number; id: string; text: string; hash: string }[] = [];
  const result = [...questions];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const hash = hashText(q.question);

    const [cached] = await db
      .select()
      .from(questionTranslations)
      .where(and(eq(questionTranslations.questionId, q.id), eq(questionTranslations.lang, lang)))
      .limit(1);

    if (cached && cached.originalHash === hash) {
      result[i] = { ...q, question: cached.translatedText };
    } else {
      needTranslation.push({ index: i, id: q.id, text: q.question, hash });
    }
  }

  if (needTranslation.length === 0) {
    return result;
  }

  try {
    const texts = needTranslation.map((n) => n.text);
    const translated = await translateWithAI(texts, lang);

    for (let j = 0; j < needTranslation.length; j++) {
      const item = needTranslation[j];
      const translatedText = translated[j];

      result[item.index] = { ...questions[item.index], question: translatedText };

      const [existing] = await db
        .select()
        .from(questionTranslations)
        .where(and(eq(questionTranslations.questionId, item.id), eq(questionTranslations.lang, lang)))
        .limit(1);

      if (existing) {
        await db
          .update(questionTranslations)
          .set({ translatedText, originalHash: item.hash, createdAt: new Date() })
          .where(eq(questionTranslations.id, existing.id));
      } else {
        await db.insert(questionTranslations).values({
          questionId: item.id,
          lang,
          translatedText,
          originalHash: item.hash,
        });
      }
    }

    logger.info({ lang, count: needTranslation.length }, 'Questions translated and cached');
  } catch (error) {
    logger.error({ err: error }, 'Question translation failed');
  }

  return result;
}
