import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../db';
import { folders } from '../db/schema';

export class FolderRepository {
  async findByUserId(userId: string) {
    return db
      .select()
      .from(folders)
      .where(and(eq(folders.userId, userId), isNull(folders.deletedAt)))
      .orderBy(folders.createdAt);
  }

  async findById(id: string) {
    const [folder] = await db
      .select()
      .from(folders)
      .where(and(eq(folders.id, id), isNull(folders.deletedAt)))
      .limit(1);
    return folder;
  }

  async findDefaultFolder(userId: string) {
    const [folder] = await db
      .select()
      .from(folders)
      .where(
        and(
          eq(folders.userId, userId),
          eq(folders.isDefault, true),
          isNull(folders.deletedAt)
        )
      )
      .limit(1);
    return folder;
  }

  async createDefault(userId: string) {
    const [folder] = await db
      .insert(folders)
      .values({
        userId,
        name: '전체',
        isDefault: true,
        color: '#F5F5DC',
      })
      .returning();
    return folder;
  }

  async create(data: {
    userId: string;
    name: string;
    coverImageUrl?: string;
    color?: string;
    isDefault?: boolean;
  }) {
    const [folder] = await db
      .insert(folders)
      .values({
        userId: data.userId,
        name: data.name,
        coverImageUrl: data.coverImageUrl,
        color: data.color,
        isDefault: data.isDefault || false,
      })
      .returning();
    return folder;
  }

  async update(id: string, data: {
    name?: string;
    coverImageUrl?: string;
    color?: string;
  }) {
    const [folder] = await db
      .update(folders)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(folders.id, id))
      .returning();
    return folder;
  }

  async delete(id: string) {
    await db
      .update(folders)
      .set({ deletedAt: new Date() })
      .where(eq(folders.id, id));
  }
}

export const folderRepository = new FolderRepository();
