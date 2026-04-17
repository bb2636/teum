import { eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import { diaryRepository } from '../repositories/diary.repository';
import { folderRepository } from '../repositories/folder.repository';
import { questionRepository } from '../repositories/question.repository';
import { userRepository } from '../repositories/user.repository';
import { questionService } from './question.service';
import { encouragementService } from './ai/encouragement.service';
import { summaryService } from './ai/summary.service';
import { titleService } from './ai/title.service';
import { logger } from '../config/logger';

export class DiaryService {
  async getDiaries(userId: string, folderId?: string, options?: { limit?: number; offset?: number }) {
    return diaryRepository.findByUserId(userId, folderId, options);
  }

  async getAllDiaries() {
    return diaryRepository.findAll();
  }

  async getDiary(id: string, userId: string) {
    const diary = await diaryRepository.findById(id);
    if (!diary || diary.userId !== userId) {
      throw new Error('Diary not found');
    }
    return diary;
  }

  async getDiariesByDateRange(userId: string, startDate: Date, endDate: Date) {
    return diaryRepository.findByDateRange(userId, startDate, endDate);
  }

  async createDiary(userId: string, data: {
    folderId?: string;
    type: 'free_form' | 'question_based';
    title?: string;
    content?: string;
    textStyle?: string;
    date: string;
    imageUrls?: string[];
    answers?: Array<{ questionId: string; answer: string }>;
  }) {
    // If no folderId provided, use default folder
    let folderId = data.folderId;
    if (!folderId) {
      let defaultFolder = await folderRepository.findDefaultFolder(userId);
      if (!defaultFolder) {
        defaultFolder = await folderRepository.createDefault(userId);
      }
      folderId = defaultFolder.id;
    }

    // Validate folder belongs to user
    const folder = await folderRepository.findById(folderId);
    if (!folder || folder.userId !== userId) {
      throw new Error('Folder not found');
    }

    // Parse date
    const date = new Date(data.date);

    // Create diary
    const diary = await diaryRepository.create({
      userId,
      folderId,
      type: data.type,
      title: data.title,
      content: data.content,
      textStyle: data.textStyle,
      date,
    });

    // Create images if provided
    if (data.imageUrls && data.imageUrls.length > 0) {
      await diaryRepository.createImages(diary.id, data.imageUrls);
    }

    // Create answers if question-based
    let questionAnswers: Array<{ question: string; answer: string }> = [];
    if (data.type === 'question_based' && data.answers && data.answers.length > 0) {
      await diaryRepository.createAnswers(diary.id, data.answers);

      await questionRepository.recordQuestionUsageBatch(
        data.answers.map((a) => ({ userId, questionId: a.questionId, diaryId: diary.id }))
      );

      const questionIds = data.answers.map((a) => a.questionId);
      const questionsFromDb = await questionRepository.findByIds(questionIds);
      const questionMap = new Map(questionsFromDb.map((q) => [q.id, q.question]));

      const missingIds = questionIds.filter((id) => !questionMap.has(id));
      if (missingIds.length > 0) {
        const { diaryQuestions } = await import('../db/schema');
        const oldQuestions = await db
          .select()
          .from(diaryQuestions)
          .where(inArray(diaryQuestions.id, missingIds));
        for (const oq of oldQuestions) {
          questionMap.set(oq.id, oq.question);
        }
        const stillMissing = missingIds.filter((id) => !questionMap.has(id));
        if (stillMissing.length > 0) {
          logger.warn({ questionIds: stillMissing, diaryId: diary.id }, 'Question text not found in both tables');
        }
      }

      questionAnswers = data.answers.map(({ questionId, answer }) => ({
        question: questionMap.get(questionId) ?? '',
        answer,
      }));
      
      // Log question answers for debugging
      logger.info('Question answers prepared for AI', {
        diaryId: diary.id,
        answersCount: questionAnswers.length,
        questionsWithText: questionAnswers.filter(qa => qa.question.trim()).length,
        sampleQuestion: questionAnswers[0]?.question?.substring(0, 50) || 'N/A',
        allQuestions: questionAnswers.map(qa => qa.question || 'NO_QUESTION'),
        allAnswers: questionAnswers.map(qa => qa.answer?.substring(0, 50) || 'NO_ANSWER'),
      });
    }

    let userLanguage = 'ko';
    try {
      const userWithProfile = await userRepository.findByIdWithProfile(userId);
      if (userWithProfile?.profile?.language) {
        userLanguage = userWithProfile.profile.language;
      }
    } catch (err) {
      logger.warn('Failed to fetch user language, defaulting to ko', { userId });
    }

    logger.info('Generating AI encouragement', {
      diaryId: diary.id,
      type: data.type,
      hasContent: !!data.content,
      contentLength: data.content?.length || 0,
      hasAnswers: questionAnswers.length > 0,
      answersCount: questionAnswers.length,
      userLanguage,
    });

    const needsTitleSuggestion = !data.title || !data.title.trim();

    try {
      await Promise.all([
        encouragementService.generateAndSaveEncouragement(diary.id, userId, {
          title: data.title,
          content: data.content,
          type: data.type,
          answers: questionAnswers,
          language: userLanguage,
        }),
        summaryService.generateAndSaveSummary(diary.id, {
          title: data.title,
          content: data.content,
          type: data.type,
          answers: questionAnswers,
          language: userLanguage,
        }),
        ...(needsTitleSuggestion
          ? [
              titleService.generateAndSaveTitle(diary.id, {
                content: data.content,
                type: data.type,
                answers: questionAnswers,
                language: userLanguage,
              }),
            ]
          : []),
      ]);
    } catch (error) {
      logger.error('Failed to generate AI content (non-blocking)', {
        error: error instanceof Error ? error.message : String(error),
        diaryId: diary.id,
      });
    }

    // Return diary with relations (including AI message)
    const fullDiary = await diaryRepository.findById(diary.id);
    if (!fullDiary) {
      throw new Error('Failed to retrieve created diary');
    }

    return fullDiary;
  }

  async updateDiary(id: string, userId: string, data: {
    folderId?: string;
    title?: string;
    content?: string;
    textStyle?: string;
    date?: string;
    imageUrls?: string[];
    answers?: Array<{ questionId: string; answer: string }>;
  }) {
    const diary = await diaryRepository.findById(id);
    if (!diary || diary.userId !== userId) {
      throw new Error('Diary not found');
    }

    // Update folder if provided
    if (data.folderId) {
      const folder = await folderRepository.findById(data.folderId);
      if (!folder || folder.userId !== userId) {
        throw new Error('Folder not found');
      }
    }

    // Parse date if provided
    const date = data.date ? new Date(data.date) : undefined;

    // Update diary
    await diaryRepository.update(id, {
      folderId: data.folderId,
      title: data.title,
      content: data.content,
      textStyle: data.textStyle,
      date,
    });

    // Update images if provided
    if (data.imageUrls !== undefined) {
      await diaryRepository.deleteImages(id);
      if (data.imageUrls.length > 0) {
        await diaryRepository.createImages(id, data.imageUrls);
      }
    }

    // Update answers if provided (question-based diary)
    if (data.answers !== undefined) {
      await diaryRepository.deleteAnswers(id);
      if (data.answers.length > 0) {
        await diaryRepository.createAnswers(id, data.answers);
      }
    }

    // Return updated diary
    const updatedDiary = await diaryRepository.findById(id);
    if (!updatedDiary) {
      throw new Error('Failed to retrieve updated diary');
    }

    // Regenerate encouragement message on update only if content changed (not title-only edits)
    if (data.content !== undefined) {
      // For question-based diaries, fetch answers to include in AI analysis
      let questionAnswers: Array<{ question: string; answer: string }> = [];
      if (updatedDiary.type === 'question_based' && updatedDiary.answers && updatedDiary.answers.length > 0) {
        const answerQuestionIds = updatedDiary.answers.map((a) => a.questionId);
        const questionsFromDb = await questionRepository.findByIds(answerQuestionIds);
        const questionMap = new Map(questionsFromDb.map((q) => [q.id, q.question]));

        for (const a of updatedDiary.answers) {
          if (!questionMap.has(a.questionId) && a.question?.question) {
            questionMap.set(a.questionId, a.question.question);
          }
        }

        const missingIds = answerQuestionIds.filter((id) => !questionMap.has(id));
        if (missingIds.length > 0) {
          const { diaryQuestions } = await import('../db/schema');
          const oldQuestions = await db
            .select()
            .from(diaryQuestions)
            .where(inArray(diaryQuestions.id, missingIds));
          for (const oq of oldQuestions) {
            questionMap.set(oq.id, oq.question);
          }
        }

        questionAnswers = updatedDiary.answers.map((a) => ({
          question: questionMap.get(a.questionId) ?? '',
          answer: a.answer,
        }));
        
        logger.info('Question answers prepared for AI (update)', {
          diaryId: id,
          answersCount: questionAnswers.length,
          questionsWithText: questionAnswers.filter(qa => qa.question.trim()).length,
        });
      }
      
      let updateLanguage = 'ko';
      try {
        const userWithProfile = await userRepository.findByIdWithProfile(userId);
        if (userWithProfile?.profile?.language) {
          updateLanguage = userWithProfile.profile.language;
        }
      } catch (err) {
        logger.warn('Failed to fetch user language for update, defaulting to ko', { userId });
      }

      const aiData = {
        title: updatedDiary.title || undefined,
        content: updatedDiary.content || undefined,
        type: updatedDiary.type,
        answers: questionAnswers.length > 0 ? questionAnswers : undefined,
        language: updateLanguage,
      };
      Promise.all([
        encouragementService.generateAndSaveEncouragement(id, userId, aiData),
        summaryService.generateAndSaveSummary(id, aiData),
      ]).catch((error) => {
        logger.error('Failed to regenerate AI content (non-blocking)', { 
          error: error instanceof Error ? error.message : String(error),
          diaryId: id,
        });
      });
    }

    return updatedDiary;
  }

  async deleteDiary(id: string, userId: string) {
    const diary = await diaryRepository.findById(id);
    if (!diary || diary.userId !== userId) {
      throw new Error('Diary not found');
    }

    await diaryRepository.delete(id);
  }
}

export const diaryService = new DiaryService();
