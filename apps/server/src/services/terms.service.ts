import { termsRepository } from '../repositories/terms.repository';
import { logger } from '../config/logger';

const TERMS_TITLES: Record<string, string> = {
  service: '서비스 이용약관',
  privacy: '개인정보 처리방침',
  payment: '정기결제/자동갱신',
  refund: '환불/취소 정책',
};

export class TermsService {
  async getAllTerms() {
    logger.info('Fetching all terms');
    const allTerms = await termsRepository.findAll();
    const seen = new Set<string>();
    const unique = allTerms.filter((t) => {
      if (seen.has(t.type)) return false;
      seen.add(t.type);
      return true;
    });
    return unique.map((t) => ({
      type: t.type,
      title: TERMS_TITLES[t.type] || t.type,
      version: t.version,
      updatedAt: t.updatedAt,
    }));
  }

  async getTerms(type: 'service' | 'privacy' | 'payment' | 'refund') {
    logger.info('Fetching terms', { type });
    return termsRepository.findByType(type);
  }

  async createOrUpdateTerms(type: 'service' | 'privacy' | 'payment' | 'refund', content: string, incrementVersion: boolean = true) {
    logger.info('Creating or updating terms', { type, incrementVersion });
    
    const existing = await termsRepository.findByType(type);
    
    if (existing) {
      if (incrementVersion) {
        // Update existing terms - increment version
        const newVersion = await termsRepository.incrementVersion(existing.version);
        return termsRepository.update(existing.id, {
          version: newVersion,
          content,
        });
      } else {
        // Auto-save: update content only, keep version
        return termsRepository.update(existing.id, {
          content,
        });
      }
    } else {
      // Create new terms - start with version 1.0
      return termsRepository.create({
        type,
        version: '1.0',
        content,
      });
    }
  }
}

export const termsService = new TermsService();
