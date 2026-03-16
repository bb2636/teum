import { describe, it, expect } from 'vitest';
import { generateMusicSchema } from '../music';

// Helper to generate valid UUIDs
const generateUUID = (index: number) => {
  // Generate a valid UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  const hex = index.toString(16).padStart(32, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};

describe('Music Validation', () => {
  describe('generateMusicSchema', () => {
    it('should validate correct input with 7 diary IDs', () => {
      const input = {
        diaryIds: Array.from({ length: 7 }, (_, i) => generateUUID(i)),
      };

      const result = generateMusicSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject input with less than 7 diary IDs', () => {
      const input = {
        diaryIds: Array.from({ length: 6 }, (_, i) => generateUUID(i)),
      };

      const result = generateMusicSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject input with more than 7 diary IDs', () => {
      const input = {
        diaryIds: Array.from({ length: 8 }, (_, i) => generateUUID(i)),
      };

      const result = generateMusicSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid UUID format', () => {
      const input = {
        diaryIds: ['invalid-uuid', ...Array.from({ length: 6 }, (_, i) => generateUUID(i))],
      };

      const result = generateMusicSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});
