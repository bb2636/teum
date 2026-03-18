import { StorageAdapter } from './base';
import { db } from '../../db';
import { files } from '../../db/schema/files';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export class DatabaseStorageAdapter implements StorageAdapter {
  async upload(file: Buffer, filename: string, mimetype: string): Promise<string> {
    const id = uuidv4();
    const filePath = `uploads/${id}-${filename}`;

    await db.insert(files).values({
      path: filePath,
      mimetype,
      data: file,
    });

    return `/storage/${filePath}`;
  }

  async delete(url: string): Promise<void> {
    const filePath = url.replace('/storage/', '');
    await db.delete(files).where(eq(files.path, filePath));
  }

  getUrl(path: string): string {
    return `/storage/${path}`;
  }

  async get(path: string): Promise<{ buffer: Buffer; mimetype: string } | null> {
    const result = await db.select().from(files).where(eq(files.path, path)).limit(1);
    if (result.length === 0) return null;
    return {
      buffer: Buffer.from(result[0].data),
      mimetype: result[0].mimetype,
    };
  }
}
