import { termsRepository } from '../repositories/terms.repository';
import { logger } from '../config/logger';

export class TermsService {
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
