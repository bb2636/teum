import { z } from 'zod';

/**
 * Music generation request schema
 * Requires exactly 7 diary IDs
 */
export const generateMusicSchema = z.object({
  diaryIds: z
    .array(z.string().uuid())
    .length(7, 'Exactly 7 diary IDs are required'),
});

export type GenerateMusicInput = z.infer<typeof generateMusicSchema>;
