import { diaryRepository } from '../repositories/diary.repository';
import { folderRepository } from '../repositories/folder.repository';
import { questionSetRepository } from '../repositories/question-set.repository';
import { questionService } from './question.service';
import { encouragementService } from './ai/encouragement.service';

export class DiaryService {
  async getDiaries(userId: string, folderId?: string) {
    return diaryRepository.findByUserId(userId, folderId);
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
    questionSetId?: string;
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
      questionSetId: data.questionSetId,
      date,
    });

    // Create images if provided
    if (data.imageUrls && data.imageUrls.length > 0) {
      await diaryRepository.createImages(diary.id, data.imageUrls);
    }

    // Create answers if question-based
    let questionAnswers: Array<{ question: string; answer: string }> = [];
    if (data.type === 'question_based' && data.answers && data.answers.length > 0) {
      // Validate question set
      if (data.questionSetId) {
        const questionSet = await questionSetRepository.findById(data.questionSetId);
        if (!questionSet) {
          throw new Error('Question set not found');
        }
      }

      await diaryRepository.createAnswers(diary.id, data.answers);
      
      // Record question usage for new question system
      for (const answer of data.answers) {
        await questionService.recordQuestionUsage(userId, answer.questionId, diary.id);
      }
      
      // Load questions for encouragement generation
      const createdAnswers = await diaryRepository.findAnswersByDiaryId(diary.id);
      questionAnswers = createdAnswers.map((a) => ({
        question: a.question?.question || '',
        answer: a.answer,
      }));
    }

    // Return diary with relations
    const fullDiary = await diaryRepository.findById(diary.id);
    if (!fullDiary) {
      throw new Error('Failed to retrieve created diary');
    }

    // Trigger encouragement generation asynchronously (non-blocking)
    // This should not affect diary creation if it fails
    encouragementService
      .generateAndSaveEncouragement(diary.id, userId, {
        title: data.title,
        content: data.content,
        type: data.type,
        answers: questionAnswers,
      })
      .catch((error) => {
        // Log but don't throw - diary creation should succeed even if AI fails
        console.error('Failed to generate encouragement (non-blocking)', error);
      });

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

    // Optionally regenerate encouragement message on update
    // For now, we'll regenerate if content changed
    if (data.content !== undefined || data.title !== undefined) {
      encouragementService
        .generateAndSaveEncouragement(id, userId, {
          title: updatedDiary.title || undefined,
          content: updatedDiary.content || undefined,
          type: updatedDiary.type,
        })
        .catch((error) => {
          console.error('Failed to regenerate encouragement (non-blocking)', error);
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
