import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MusicOrchestratorService } from '../music-orchestrator.service';
import { lyricAnalysisService } from '../../ai/lyric-analysis.service';
import { murekaProvider } from '../mureka.provider';
import { diaryRepository } from '../../../repositories/diary.repository';
import { db } from '../../../db';
import { musicJobs } from '../../../db/schema';

// Mock dependencies
vi.mock('../../ai/lyric-analysis.service');
vi.mock('../mureka.provider');
vi.mock('../../../repositories/diary.repository');
vi.mock('../../../db', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'job-id' }]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

describe('MusicOrchestratorService', () => {
  let service: MusicOrchestratorService;

  beforeEach(() => {
    service = new MusicOrchestratorService();
    vi.clearAllMocks();
  });

  describe('generateMusic', () => {
    it('should throw error if not exactly 7 diaries', async () => {
      await expect(
        service.generateMusic('user-id', ['diary1', 'diary2'])
      ).rejects.toThrow('Exactly 7 diaries are required');
    });

    it('should create music job and process it', async () => {
      const diaryIds = Array.from({ length: 7 }, (_, i) => `diary-${i}`);
      const now = new Date();
      const mockDiaries = diaryIds.map((id) => ({
        id,
        userId: 'user-id',
        title: 'Test Diary',
        content: 'Test content',
        date: now,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        folderId: null,
        type: 'free_form' as const,
        textStyle: null,
        questionSetId: null,
        images: [],
        answers: [],
        imageUrl: null,
        aiMessage: null,
        aiSummary: null,
        aiFeedback: [],
      }));

      vi.mocked(diaryRepository.findById).mockImplementation((id) =>
        Promise.resolve(mockDiaries.find((d) => d.id === id)!)
      );

      vi.mocked(lyricAnalysisService.analyzeDiaries).mockResolvedValue({
        titleKo: '행복한 순간',
        titleEn: 'Happy Moment',
        overallEmotion: 'happy',
        mood: 'upbeat',
        keywords: ['joy', 'celebration'],
        lyricalTheme: '행복한 순간',
        lyrics: 'Test lyrics',
        musicPrompt: 'upbeat happy music',
      });

      vi.mocked(murekaProvider.generateMusic).mockResolvedValue({
        provider: 'mureka',
        audioUrl: 'https://example.com/audio.mp3',
        status: 'completed',
      });

      const result = await service.generateMusic('user-id', diaryIds);

      expect(result.status).toBe('completed');
      expect(result.audioUrl).toBe('https://example.com/audio.mp3');
    });

    it('should handle async generation with job ID', async () => {
      const diaryIds = Array.from({ length: 7 }, (_, i) => `diary-${i}`);
      const now = new Date();
      const mockDiaries = diaryIds.map((id) => ({
        id,
        userId: 'user-id',
        title: 'Test Diary',
        content: 'Test content',
        date: now,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        folderId: null,
        type: 'free_form' as const,
        textStyle: null,
        questionSetId: null,
        images: [],
        answers: [],
        imageUrl: null,
        aiMessage: null,
        aiSummary: null,
        aiFeedback: [],
      }));

      vi.mocked(diaryRepository.findById).mockImplementation((id) =>
        Promise.resolve(mockDiaries.find((d) => d.id === id)!)
      );

      vi.mocked(lyricAnalysisService.analyzeDiaries).mockResolvedValue({
        titleKo: '행복',
        titleEn: 'Happiness',
        overallEmotion: 'happy',
        mood: 'upbeat',
        keywords: ['joy'],
        lyricalTheme: '행복',
        lyrics: 'Test lyrics',
        musicPrompt: 'upbeat music',
      });

      vi.mocked(murekaProvider.generateMusic).mockResolvedValue({
        provider: 'mureka',
        providerJobId: 'provider-job-id',
        status: 'processing',
      });

      const result = await service.generateMusic('user-id', diaryIds);

      expect(result.status).toBe('processing');
      expect(result.audioUrl).toBeUndefined();
    });
  });
});
