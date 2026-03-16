import { z } from 'zod';

// Folder validation
export const createFolderSchema = z.object({
  name: z.string().min(1, 'Folder name is required').max(100),
  coverImageUrl: z.string().url().optional().or(z.literal('')),
  color: z.string().optional(),
});

export const updateFolderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  coverImageUrl: z.string().url().optional().or(z.literal('')),
  color: z.string().optional(),
});

// Diary validation
export const createDiarySchema = z.object({
  folderId: z.string().uuid().optional(),
  type: z.enum(['free_form', 'question_based']),
  title: z.string().max(200).optional(),
  content: z.string().optional(),
  textStyle: z.string().optional(), // JSON string
  questionSetId: z.string().uuid().optional(),
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  imageUrls: z.array(z.string().url()).optional(),
  answers: z.array(
    z.object({
      questionId: z.string().uuid(),
      answer: z.string().min(1),
    })
  ).optional(),
});

export const updateDiarySchema = z.object({
  folderId: z.string().uuid().optional(),
  title: z.string().max(200).optional(),
  content: z.string().optional(),
  textStyle: z.string().optional(),
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  imageUrls: z.array(z.string().url()).optional(),
});

// Calendar query
export const calendarQuerySchema = z.object({
  year: z.string().regex(/^\d{4}$/),
  month: z.string().regex(/^\d{1,2}$/),
});

export type CreateFolderInput = z.infer<typeof createFolderSchema>;
export type UpdateFolderInput = z.infer<typeof updateFolderSchema>;
export type CreateDiaryInput = z.infer<typeof createDiarySchema>;
export type UpdateDiaryInput = z.infer<typeof updateDiarySchema>;
export type CalendarQueryInput = z.infer<typeof calendarQuerySchema>;
