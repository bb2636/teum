import { z } from 'zod';

export const createQuestionSchema = z.object({
  question: z.string().min(1, '질문을 입력해주세요').max(500, '질문은 500자 이하여야 합니다'),
  isActive: z.boolean().optional(),
});

export const updateQuestionSchema = z.object({
  question: z.string().min(1).max(500).optional(),
  isActive: z.boolean().optional(),
});

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
