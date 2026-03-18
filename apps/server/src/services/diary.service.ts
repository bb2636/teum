import { eq } from 'drizzle-orm';
import { db } from '../db';
import { diaryRepository } from '../repositories/diary.repository';
import { folderRepository } from '../repositories/folder.repository';
import { questionRepository } from '../repositories/question.repository';
import { questionService } from './question.service';
import { encouragementService } from './ai/encouragement.service';
import { logger } from '../config/logger';

export class DiaryService {
  async getDiaries(userId: string, folderId?: string) {
    return diaryRepository.findByUserId(userId, folderId);
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
      const defaultFolder = await folderRepository.findDefaultFolder(userId);
      if (!defaultFolder) {
        throw new Error('Default folder not found');
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

      // Record question usage for new question system
      for (const answer of data.answers) {
        await questionService.recordQuestionUsage(userId, answer.questionId, diary.id);
      }

      // Build questionAnswers for AI encouragement: fetch question text from questions table
      // (diary_answers.questionId can reference either questions table (new) or diary_questions (old))
      questionAnswers = await Promise.all(
        data.answers.map(async ({ questionId, answer }) => {
          // Try to get question from questions table first (new system)
          let q = await questionRepository.findById(questionId);
          let questionText = q?.question ?? '';
          
          // If not found, try diary_questions table (old system, backward compatibility)
          if (!questionText) {
            const { diaryQuestions } = await import('../db/schema');
            const [oldQuestion] = await db
              .select()
              .from(diaryQuestions)
              .where(eq(diaryQuestions.id, questionId))
              .limit(1);
            questionText = oldQuestion?.question ?? '';
            
            if (questionText) {
              logger.info('Found question in diary_questions table (old system)', { questionId, diaryId: diary.id });
            }
          }
          
          if (!questionText) {
            logger.warn('Question text not found in both tables for questionId', { questionId, diaryId: diary.id });
          }
          return { question: questionText, answer };
        })
      );
      
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

    // Generate AI encouragement synchronously so it's included in the response
    logger.info('Generating AI encouragement', {
      diaryId: diary.id,
      type: data.type,
      hasContent: !!data.content,
      contentLength: data.content?.length || 0,
      hasAnswers: questionAnswers.length > 0,
      answersCount: questionAnswers.length,
    });

    try {
      await encouragementService.generateAndSaveEncouragement(diary.id, userId, {
        title: data.title,
        content: data.content,
        type: data.type,
        answers: questionAnswers,
      });
    } catch (error) {
      logger.error('Failed to generate encouragement (non-blocking)', {
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

    // Return updated diary
    const updatedDiary = await diaryRepository.findById(id);
    if (!updatedDiary) {
      throw new Error('Failed to retrieve updated diary');
    }

    // Regenerate encouragement message on update if content changed
    if (data.content !== undefined || data.title !== undefined) {
      // For question-based diaries, fetch answers to include in AI analysis
      let questionAnswers: Array<{ question: string; answer: string }> = [];
      if (updatedDiary.type === 'question_based' && updatedDiary.answers && updatedDiary.answers.length > 0) {
        // Build questionAnswers from existing answers
        questionAnswers = await Promise.all(
          updatedDiary.answers.map(async (answer) => {
            // Try to get question from questions table first (new system)
            let q = await questionRepository.findById(answer.questionId);
            let questionText = q?.question ?? '';
            
            // If not found, try diary_questions table (old system, backward compatibility)
            if (!questionText && answer.question?.question) {
              questionText = answer.question.question;
            }
            
            if (!questionText) {
              const { diaryQuestions } = await import('../db/schema');
              const [oldQuestion] = await db
                .select()
                .from(diaryQuestions)
                .where(eq(diaryQuestions.id, answer.questionId))
                .limit(1);
              questionText = oldQuestion?.question ?? '';
            }
            
            return { question: questionText, answer: answer.answer };
          })
        );
        
        logger.info('Question answers prepared for AI (update)', {
          diaryId: id,
          answersCount: questionAnswers.length,
          questionsWithText: questionAnswers.filter(qa => qa.question.trim()).length,
        });
      }
      
      encouragementService
        .generateAndSaveEncouragement(id, userId, {
          title: updatedDiary.title || undefined,
          content: updatedDiary.content || undefined,
          type: updatedDiary.type,
          answers: questionAnswers.length > 0 ? questionAnswers : undefined,
        })
        .catch((error) => {
          logger.error('Failed to regenerate encouragement (non-blocking)', { 
            error: error instanceof Error ? error.message : String(error),
            errorName: error instanceof Error ? error.name : undefined,
            errorCode: (error as any)?.code,
            errorStatus: (error as any)?.status,
            diaryId: id,
            diaryType: updatedDiary.type,
            hasAnswers: questionAnswers.length > 0,
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
