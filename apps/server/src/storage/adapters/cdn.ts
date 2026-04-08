import { StorageAdapter } from './base';
import { logger } from '../../config/logger';
import crypto from 'crypto';

export class CDNStorageAdapter implements StorageAdapter {
  private cdnUrl: string;
  private bucketName: string;
  private endpoint: string;
  private accessKeyId: string;
  private secretAccessKey: string;
  private region: string;

  constructor() {
    this.cdnUrl = process.env.CDN_URL || '';
    this.bucketName = process.env.CDN_BUCKET_NAME || '';
    this.endpoint = process.env.CDN_ENDPOINT || '';
    this.accessKeyId = process.env.CDN_ACCESS_KEY_ID || '';
    this.secretAccessKey = process.env.CDN_SECRET_ACCESS_KEY || '';
    this.region = process.env.CDN_REGION || 'auto';

    if (!this.cdnUrl || !this.bucketName || !this.endpoint || !this.accessKeyId || !this.secretAccessKey) {
      logger.warn('CDN storage not fully configured — uploads will fail until CDN_URL, CDN_BUCKET_NAME, CDN_ENDPOINT, CDN_ACCESS_KEY_ID, CDN_SECRET_ACCESS_KEY are set');
    }
  }

  private sign(method: string, path: string, headers: Record<string, string>, payload: Buffer | ''): Record<string, string> {
    const now = new Date();
    const dateStamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const shortDate = dateStamp.slice(0, 8);

    const host = new URL(this.endpoint).host;
    headers['host'] = host;
    headers['x-amz-date'] = dateStamp;
    headers['x-amz-content-sha256'] = crypto.createHash('sha256').update(payload).digest('hex');

    const signedHeaderKeys = Object.keys(headers).sort();
    const signedHeaders = signedHeaderKeys.join(';');
    const canonicalHeaders = signedHeaderKeys.map(k => `${k}:${headers[k]}\n`).join('');
    const payloadHash = headers['x-amz-content-sha256'];

    const canonicalRequest = [method, path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
    const scope = `${shortDate}/${this.region}/s3/aws4_request`;
    const stringToSign = ['AWS4-HMAC-SHA256', dateStamp, scope, crypto.createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');

    const hmac = (key: Buffer | string, data: string) => crypto.createHmac('sha256', key).update(data).digest();
    const kDate = hmac(`AWS4${this.secretAccessKey}`, shortDate);
    const kRegion = hmac(kDate, this.region);
    const kService = hmac(kRegion, 's3');
    const kSigning = hmac(kService, 'aws4_request');
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    headers['authorization'] = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    return headers;
  }

  async upload(file: Buffer, filename: string, mimeType: string): Promise<string> {
    const path = `/${this.bucketName}/${filename}`;
    const headers: Record<string, string> = { 'content-type': mimeType, 'content-length': String(file.length) };
    const signed = this.sign('PUT', path, headers, file);

    const url = `${this.endpoint}${path}`;
    const response = await fetch(url, { method: 'PUT', headers: signed, body: file });

    if (!response.ok) {
      const body = await response.text();
      logger.error('CDN upload failed', { status: response.status, body, filename });
      throw new Error(`CDN upload failed: ${response.status}`);
    }

    const publicUrl = `${this.cdnUrl}/${filename}`;
    logger.info('CDN upload completed', { filename, publicUrl });
    return publicUrl;
  }

  async delete(url: string): Promise<void> {
    const filename = url.replace(this.cdnUrl + '/', '');
    const path = `/${this.bucketName}/${filename}`;
    const headers: Record<string, string> = {};
    const signed = this.sign('DELETE', path, headers, '');

    const endpointUrl = `${this.endpoint}${path}`;
    const response = await fetch(endpointUrl, { method: 'DELETE', headers: signed });

    if (!response.ok) {
      const body = await response.text();
      logger.error('CDN delete failed', { status: response.status, body, filename });
      throw new Error(`CDN delete failed: ${response.status}`);
    }

    logger.info('CDN file deleted', { filename });
  }

  async get(path: string): Promise<{ buffer: Buffer; mimetype: string } | null> {
    const objectPath = `/${this.bucketName}/${path}`;
    const headers: Record<string, string> = {};
    const signed = this.sign('GET', objectPath, headers, '');

    const url = `${this.endpoint}${objectPath}`;
    const response = await fetch(url, { method: 'GET', headers: signed });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`CDN get failed: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const mimetype = response.headers.get('content-type') || 'application/octet-stream';
    return { buffer, mimetype };
  }

  getUrl(path: string): string {
    return `${this.cdnUrl}/${path}`;
  }
}
