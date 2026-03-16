import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EncouragementService } from '../encouragement.service';
import { openAIProvider } from '../openai.provider';
import { db } from '../../../db';
import { aiFeedback } from '../../../db/schema';
import { diaries } from '../../../db/schema';

// Mock dependencies
vi.mock('../openai.provider');
vi.mock('../../../db', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue([]),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

describe('EncouragementService', () => {
  let service: EncouragementService;

  beforeEach(() => {
    service = new EncouragementService();
    vi.clearAllMocks();
  });

  describe('generateAndSaveEncouragement', () => {
    it('should skip generation if AI encouragement is disabled', async () => {
      process.env.AI_ENCOURAGEMENT_ENABLED = 'false';

      await service.generateAndSaveEncouragement(
        'diary-id',
        'user-id',
        {
          type: 'free_form',
          content: 'Test content',
        }
      );

      expect(openAIProvider.generateEncouragement).not.toHaveBeenCalled();
    });

    it('should generate and save encouragement message', async () => {
      process.env.AI_ENCOURAGEMENT_ENABLED = 'true';
      const mockMessage = '테스트 응원 메시지';

      vi.mocked(openAIProvider.generateEncouragement).mockResolvedValue(mockMessage);

      await service.generateAndSaveEncouragement(
        'diary-id',
        'user-id',
        {
          type: 'free_form',
          content: 'Test content',
        }
      );

      expect(openAIProvider.generateEncouragement).toHaveBeenCalledWith({
        type: 'free_form',
        content: 'Test content',
      });
    });

    it('should handle errors gracefully without throwing', async () => {
      process.env.AI_ENCOURAGEMENT_ENABLED = 'true';

      vi.mocked(openAIProvider.generateEncouragement).mockRejectedValue(
        new Error('API Error')
      );

      // Should not throw
      await expect(
        service.generateAndSaveEncouragement(
          'diary-id',
          'user-id',
          {
            type: 'free_form',
            content: 'Test content',
          }
        )
      ).resolves.not.toThrow();
    });
  });
});
