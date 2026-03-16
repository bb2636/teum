import { z } from 'zod';

export const createInquirySchema = z.object({
  subject: z.string().min(1).max(200, '제목은 200자 이하여야 합니다'),
  message: z.string().min(10, '문의 내용은 최소 10자 이상이어야 합니다'),
});

export type CreateInquiryInput = z.infer<typeof createInquirySchema>;
