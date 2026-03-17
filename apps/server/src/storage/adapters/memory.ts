import { StorageAdapter } from './base';
import { v4 as uuidv4 } from 'uuid';

// In-memory storage for development
const storage = new Map<string, { buffer: Buffer; mimetype: string }>();

export class MemoryStorageAdapter implements StorageAdapter {
  async upload(file: Buffer, filename: string, mimetype: string): Promise<string> {
    const id = uuidv4();
    const path = `uploads/${id}-${filename}`;
    storage.set(path, { buffer: file, mimetype });
    
    // Return a mock URL (in production, this would be a real URL)
    return `/storage/${path}`;
  }

  async delete(url: string): Promise<void> {
    const path = url.replace('/storage/', '');
    storage.delete(path);
  }

  getUrl(path: string): string {
    return `/storage/${path}`;
  }

  async get(path: string): Promise<{ buffer: Buffer; mimetype: string } | null> {
    const entry = storage.get(path);
    return entry ?? null;
  }
}
