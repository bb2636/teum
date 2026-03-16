import { eq, and, isNull, desc } from 'drizzle-orm';
import { db } from '../db';
import { terms } from '../db/schema';

export class TermsRepository {
  async findByType(type: 'service' | 'privacy') {
    const [term] = await db
      .select()
      .from(terms)
      .where(and(eq(terms.type, type), isNull(terms.deletedAt)))
      .orderBy(desc(terms.updatedAt))
      .limit(1);
    return term;
  }

  async create(data: {
    type: 'service' | 'privacy';
    version: string;
    content: string;
  }) {
    const [term] = await db
      .insert(terms)
      .values({
        type: data.type,
        version: data.version,
        content: data.content,
      })
      .returning();
    return term;
  }

  async update(id: string, data: {
    version?: string;
    content?: string;
  }) {
    const [term] = await db
      .update(terms)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(terms.id, id))
      .returning();
    return term;
  }

  async incrementVersion(currentVersion: string): Promise<string> {
    // Parse version (e.g., "1.0" -> major: 1, minor: 0)
    const parts = currentVersion.split('.');
    const major = parseInt(parts[0] || '1', 10);
    const minor = parseInt(parts[1] || '0', 10);
    
    // Increment minor version
    const newMinor = minor + 1;
    return `${major}.${newMinor}`;
  }
}

export const termsRepository = new TermsRepository();
