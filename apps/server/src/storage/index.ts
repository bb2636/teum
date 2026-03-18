import { StorageAdapter } from './adapters/base';
import { MemoryStorageAdapter } from './adapters/memory';
import { CDNStorageAdapter } from './adapters/cdn';
import { DatabaseStorageAdapter } from './adapters/database';
import * as dotenv from 'dotenv';
import { logger } from '../config/logger';

dotenv.config();

let adapter: StorageAdapter;

const storageType = process.env.STORAGE_ADAPTER || 'database';

switch (storageType) {
  case 'memory':
    adapter = new MemoryStorageAdapter();
    logger.info('Using memory storage adapter');
    break;
  case 'cdn':
    adapter = new CDNStorageAdapter();
    logger.info('Using CDN storage adapter');
    break;
  case 'database':
    adapter = new DatabaseStorageAdapter();
    logger.info('Using database storage adapter');
    break;
  default:
    adapter = new DatabaseStorageAdapter();
    logger.info('Using default database storage adapter');
}

export { adapter };
export type { StorageAdapter };
