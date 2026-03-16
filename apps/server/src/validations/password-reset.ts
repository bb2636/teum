import { z } from 'zod';

export const requestPasswordResetSchema = z.object({
  email: z.string().email('올바른 이메일을 입력해주세요'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, '토큰이 필요합니다'),
  password: z
    .string()
    .min(8, '비밀번호는 8자 이상이어야 합니다')
    .refine((val) => /[a-zA-Z]/.test(val), '비밀번호는 영문을 포함해야 합니다')
    .refine((val) => /[0-9]/.test(val), '비밀번호는 숫자를 포함해야 합니다'),
});

export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
