import { db } from '../db';
import { termsConsents } from '../db/schema';

export class TermsConsentRepository {
  async createMany(data: Array<{ userId: string; termsType: string; consented: boolean }>) {
    if (data.length === 0) return [];
    
    const consents = await db
      .insert(termsConsents)
      .values(
        data.map((item) => ({
          userId: item.userId,
          termsType: item.termsType,
          consented: item.consented,
        }))
      )
      .returning();
    return consents;
  }
}

export const termsConsentRepository = new TermsConsentRepository();
