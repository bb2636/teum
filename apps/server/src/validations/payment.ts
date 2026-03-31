import { z } from 'zod';

export const processPaymentSchema = z.object({
  amount: z.number().positive('결제 금액은 0보다 커야 합니다'),
  planName: z.string().min(1, '플랜 이름이 필요합니다'),
  paymentMethod: z.enum(['CARD'], {
    errorMap: () => ({ message: '유효한 결제 수단을 선택해주세요' }),
  }),
  cardCompany: z.string().optional(),
  cardCode: z.string().optional(),
  isRenewal: z.boolean().optional(),
});

export type ProcessPaymentInput = z.infer<typeof processPaymentSchema>;
