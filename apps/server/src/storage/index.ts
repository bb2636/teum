import { StorageAdapter } from './adapters/base';
import { MemoryStorageAdapter } from './adapters/memory';
import { CDNStorageAdapter } from './adapters/cdn';
import * as dotenv from 'dotenv';
import { logger } from '../config/logger';

dotenv.config();

let adapter: StorageAdapter;

const storageType = process.env.STORAGE_ADAPTER || 'memory';

switch (storageType) {
  case 'memory':
    adapter = new MemoryStorageAdapter();
    logger.info('Using memory storage adapter');
    break;
  case 'cdn':
    adapter = new CDNStorageAdapter();
    logger.info('Using CDN storage adapter');
    break;
  case 'replit':
    // TODO: Implement Replit storage adapter
    adapter = new MemoryStorageAdapter();
    logger.warn('Replit storage adapter not implemented, using memory');
    break;
  default:
    adapter = new MemoryStorageAdapter();
    logger.info('Using default memory storage adapter');
}

export { adapter };
export type { StorageAdapter };
