export interface StorageAdapter {
  upload(file: Buffer, filename: string, mimetype: string): Promise<string>;
  delete(url: string): Promise<void>;
  getUrl(path: string): string;
  /** Get file buffer by path (path = URL without /storage/ prefix). Return null if not found. */
  get?(path: string): Promise<{ buffer: Buffer; mimetype: string } | null>;
}
