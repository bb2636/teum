import {
  AppStoreServerAPIClient,
  Environment,
  SignedDataVerifier,
  ReceiptUtility,
  Order,
  ProductType,
  ResponseBodyV2DecodedPayload,
  JWSTransactionDecodedPayload,
  JWSRenewalInfoDecodedPayload,
  NotificationTypeV2,
  Subtype,
} from '@apple/app-store-server-library';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../config/logger';

const APPLE_BUNDLE_ID = process.env.APPLE_BUNDLE_ID || 'com.teum.app';
const APPLE_ISSUER_ID = process.env.APPLE_ISSUER_ID || '';
// IAP/App Store Server API 전용 키.
// 우선 APPLE_IAP_KEY_ID/APPLE_IAP_PRIVATE_KEY를 사용하고,
// 미설정 시 Apple Sign In과 동일한 키를 공유하던 기존 동작으로 폴백.
const APPLE_KEY_ID = process.env.APPLE_IAP_KEY_ID || process.env.APPLE_KEY_ID || '';
const APPLE_PRIVATE_KEY = process.env.APPLE_IAP_PRIVATE_KEY || process.env.APPLE_PRIVATE_KEY || '';
const APPLE_APP_ID_NUMERIC = Number(process.env.APPLE_APP_ID_NUMERIC || '6762346897');
const APPLE_ENVIRONMENT: Environment =
  process.env.APPLE_ENV === 'production' ? Environment.PRODUCTION : Environment.SANDBOX;

function loadAppleRootCAs(): Buffer[] {
  const candidates = [
    path.resolve(process.cwd(), 'apple-certs'),
    path.resolve(__dirname, '../../../apple-certs'),
    path.resolve(__dirname, '../../../../apple-certs'),
  ];
  for (const dir of candidates) {
    try {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir).filter((f) => f.endsWith('.cer') || f.endsWith('.der'));
        if (files.length > 0) {
          return files.map((f) => fs.readFileSync(path.join(dir, f)));
        }
      }
    } catch {}
  }
  return [];
}

export interface AppleVerifiedTransaction {
  originalTransactionId: string;
  transactionId: string;
  productId: string;
  purchaseDate: Date;
  expiresDate: Date | null;
  environment: 'Sandbox' | 'Production';
  isTrialPeriod: boolean;
}

export class AppleProvider {
  private client: AppStoreServerAPIClient | null = null;
  private verifier: SignedDataVerifier | null = null;
  private enabled = false;

  constructor() {
    if (!APPLE_KEY_ID || !APPLE_PRIVATE_KEY || !APPLE_ISSUER_ID) {
      logger.warn(
        'Apple provider: missing credentials (APPLE_IAP_KEY_ID/APPLE_IAP_PRIVATE_KEY/APPLE_ISSUER_ID — APPLE_KEY_ID/APPLE_PRIVATE_KEY 폴백 가능)'
      );
      return;
    }
    try {
      const privateKey = APPLE_PRIVATE_KEY.includes('-----BEGIN')
        ? APPLE_PRIVATE_KEY
        : `-----BEGIN PRIVATE KEY-----\n${APPLE_PRIVATE_KEY.replace(/\\n/g, '\n')}\n-----END PRIVATE KEY-----`;

      this.client = new AppStoreServerAPIClient(
        privateKey,
        APPLE_KEY_ID,
        APPLE_ISSUER_ID,
        APPLE_BUNDLE_ID,
        APPLE_ENVIRONMENT,
      );

      const rootCAs = loadAppleRootCAs();
      this.verifier = new SignedDataVerifier(
        rootCAs,
        rootCAs.length > 0,
        APPLE_ENVIRONMENT,
        APPLE_BUNDLE_ID,
        APPLE_APP_ID_NUMERIC,
      );

      this.enabled = true;
      logger.info('Apple provider initialized', {
        env: APPLE_ENVIRONMENT,
        bundleId: APPLE_BUNDLE_ID,
        rootCertsLoaded: rootCAs.length,
      });
    } catch (error) {
      logger.error('Apple provider initialization failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Verify a transaction by its transactionId (from StoreKit 2).
   * Returns the latest signed transaction info (decoded JWS payload).
   */
  async verifyTransactionId(transactionId: string): Promise<AppleVerifiedTransaction> {
    if (!this.client || !this.verifier) {
      throw new Error('Apple provider not configured');
    }

    let history;
    try {
      history = await this.client.getTransactionHistory(transactionId, null, {
        sort: Order.DESCENDING,
        productTypes: [ProductType.AUTO_RENEWABLE],
      });
    } catch (error) {
      logger.error('Apple getTransactionHistory failed', {
        transactionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Apple 영수증 조회에 실패했습니다.');
    }

    const signedTx = history.signedTransactions?.[0];
    if (!signedTx) {
      throw new Error('Apple 거래 내역을 찾을 수 없습니다.');
    }

    const decoded = await this.verifier.verifyAndDecodeTransaction(signedTx);
    return this.toVerified(decoded);
  }

  /**
   * Verify a base64 receipt (legacy StoreKit 1 / appStoreReceipt fallback).
   * Extracts a transactionId then calls verifyTransactionId.
   */
  async verifyReceipt(receiptBase64: string): Promise<AppleVerifiedTransaction> {
    const receiptUtil = new ReceiptUtility();
    const txId = receiptUtil.extractTransactionIdFromAppReceipt(receiptBase64);
    if (!txId) {
      throw new Error('영수증에서 거래 ID를 추출할 수 없습니다.');
    }
    return this.verifyTransactionId(txId);
  }

  /**
   * Decode and verify an App Store Server Notification v2 payload.
   * Returns the verified payload + decoded transaction/renewal info if present.
   */
  async verifyNotification(signedPayload: string): Promise<{
    payload: ResponseBodyV2DecodedPayload;
    transaction?: JWSTransactionDecodedPayload;
    renewalInfo?: JWSRenewalInfoDecodedPayload;
  }> {
    if (!this.verifier) {
      throw new Error('Apple provider not configured');
    }

    const payload = await this.verifier.verifyAndDecodeNotification(signedPayload);

    let transaction: JWSTransactionDecodedPayload | undefined;
    let renewalInfo: JWSRenewalInfoDecodedPayload | undefined;

    const data = payload.data;
    if (data?.signedTransactionInfo) {
      transaction = await this.verifier.verifyAndDecodeTransaction(data.signedTransactionInfo);
    }
    if (data?.signedRenewalInfo) {
      renewalInfo = await this.verifier.verifyAndDecodeRenewalInfo(data.signedRenewalInfo);
    }

    return { payload, transaction, renewalInfo };
  }

  private toVerified(decoded: JWSTransactionDecodedPayload): AppleVerifiedTransaction {
    if (!decoded.originalTransactionId || !decoded.transactionId || !decoded.productId) {
      throw new Error('Invalid Apple transaction payload');
    }
    return {
      originalTransactionId: decoded.originalTransactionId,
      transactionId: decoded.transactionId,
      productId: decoded.productId,
      purchaseDate: decoded.purchaseDate ? new Date(decoded.purchaseDate) : new Date(),
      expiresDate: decoded.expiresDate ? new Date(decoded.expiresDate) : null,
      environment: (decoded.environment === 'Production' ? 'Production' : 'Sandbox') as 'Production' | 'Sandbox',
      isTrialPeriod: false,
    };
  }

  // Re-export enums for use in service layer
  static readonly NotificationTypeV2 = NotificationTypeV2;
  static readonly Subtype = Subtype;
}

export const appleProvider = new AppleProvider();
