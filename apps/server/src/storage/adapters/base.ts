export interface StorageAdapter {
  upload(file: Buffer, filename: string, mimetype: string): Promise<string>;
  delete(url: string): Promise<void>;
  getUrl(path: string): string;
}
