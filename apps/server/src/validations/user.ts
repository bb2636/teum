import { z } from 'zod';

export const updateProfileSchema = z.object({
  nickname: z.string().min(2).max(12).optional(),
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional(),
  dateOfBirth: z.string().optional(),
  profileImageUrl: z.union([z.string().url(), z.literal('')]).optional(),
  country: z.string().max(100).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
