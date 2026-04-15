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

export const initPaymentSchema = z.object({
  planName: z.string().min(1, '플랜 이름이 필요합니다'),
  paymentMethod: z.enum(['CARD'], {
    errorMap: () => ({ message: '유효한 결제 수단을 선택해주세요' }),
  }),
});

export const initBillingKeySchema = z.object({
  planName: z.string().min(1, '플랜 이름이 필요합니다'),
  paymentMethod: z.string().min(1, '결제 수단이 필요합니다'),
  identityVerified: z.boolean().optional().default(false),
});

export const cancelPaymentSchema = z.object({
  tid: z.string().min(1, '거래 ID가 필요합니다'),
  amount: z.number().positive('금액은 0보다 커야 합니다'),
  reason: z.string().min(1, '취소 사유가 필요합니다'),
});

export const cancelSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid('유효한 구독 ID가 필요합니다'),
});

export const adminCancelSubscriptionSchema = z.object({
  userId: z.string().uuid('유효한 사용자 ID가 필요합니다'),
  subscriptionId: z.string().uuid('유효한 구독 ID가 필요합니다'),
});
