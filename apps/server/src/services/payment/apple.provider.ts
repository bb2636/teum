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
import { fileURLToPath } from 'url';
import { logger } from '../../config/logger';
import { AppError } from '../../middleware/error-handler';

// ESM 환경(`"type": "module"`)에서는 __dirname이 없으므로 직접 계산
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const APPLE_BUNDLE_ID = process.env.APPLE_BUNDLE_ID || 'app.teum.com';
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
  // ⚠️ Apple 리뷰팀은 Sandbox 에서 IAP 를 테스트하지만, 운영 환경의 사용자는 Production 에서 결제한다.
  //    한 client/verifier 만 보유하면 둘 중 한쪽 환경의 transactionId 검증이 항상 실패한다.
  //    → 두 환경(Sandbox/Production) 클라이언트를 모두 보유하고,
  //      verifyTransactionId 에서 기본 환경(APPLE_ENV)부터 시도 후 실패 시 다른 환경으로 폴백한다.
  //    (Apple 공식 권장 패턴: production → sandbox 폴백)
  private clientProd: AppStoreServerAPIClient | null = null;
  private clientSandbox: AppStoreServerAPIClient | null = null;
  private verifierProd: SignedDataVerifier | null = null;
  private verifierSandbox: SignedDataVerifier | null = null;
  private enabled = false;

  // 외부에서 사용하던 client/verifier 참조 호환용 (notification 검증 등)
  private get client(): AppStoreServerAPIClient | null {
    return APPLE_ENVIRONMENT === Environment.PRODUCTION ? this.clientProd : this.clientSandbox;
  }
  private get verifier(): SignedDataVerifier | null {
    return APPLE_ENVIRONMENT === Environment.PRODUCTION ? this.verifierProd : this.verifierSandbox;
  }

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

      this.clientProd = new AppStoreServerAPIClient(
        privateKey, APPLE_KEY_ID, APPLE_ISSUER_ID, APPLE_BUNDLE_ID, Environment.PRODUCTION,
      );
      this.clientSandbox = new AppStoreServerAPIClient(
        privateKey, APPLE_KEY_ID, APPLE_ISSUER_ID, APPLE_BUNDLE_ID, Environment.SANDBOX,
      );

      const rootCAs = loadAppleRootCAs();
      this.verifierProd = new SignedDataVerifier(
        rootCAs, rootCAs.length > 0, Environment.PRODUCTION, APPLE_BUNDLE_ID, APPLE_APP_ID_NUMERIC,
      );
      this.verifierSandbox = new SignedDataVerifier(
        rootCAs, rootCAs.length > 0, Environment.SANDBOX, APPLE_BUNDLE_ID, APPLE_APP_ID_NUMERIC,
      );

      this.enabled = true;
      logger.info('Apple provider initialized (dual env)', {
        defaultEnv: APPLE_ENVIRONMENT,
        bundleId: APPLE_BUNDLE_ID,
        rootCertsLoaded: rootCAs.length,
      });
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        'Apple provider initialization failed'
      );
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
    if (!this.clientProd || !this.clientSandbox || !this.verifierProd || !this.verifierSandbox) {
      throw new AppError('Apple provider not configured', { statusCode: 503, code: 'APPLE_NOT_CONFIGURED' });
    }

    // 기본 환경 우선, 실패 시 반대 환경 폴백
    const primaryIsProd = APPLE_ENVIRONMENT === Environment.PRODUCTION;
    const order: Array<{ env: 'Production' | 'Sandbox'; client: AppStoreServerAPIClient; verifier: SignedDataVerifier }> = primaryIsProd
      ? [
          { env: 'Production', client: this.clientProd, verifier: this.verifierProd },
          { env: 'Sandbox', client: this.clientSandbox, verifier: this.verifierSandbox },
        ]
      : [
          { env: 'Sandbox', client: this.clientSandbox, verifier: this.verifierSandbox },
          { env: 'Production', client: this.clientProd, verifier: this.verifierProd },
        ];

    let lastError: unknown = null;
    for (const { env, client, verifier } of order) {
      try {
        const history = await client.getTransactionHistory(transactionId, null, {
          sort: Order.DESCENDING,
          productTypes: [ProductType.AUTO_RENEWABLE],
        });
        const signedTx = history.signedTransactions?.[0];
        if (!signedTx) {
          // 거래 자체가 다른 환경에 있을 수 있으므로 폴백 시도
          lastError = new AppError('Apple 거래 내역을 찾을 수 없습니다.', { statusCode: 404, code: 'APPLE_TX_NOT_FOUND' });
          logger.warn('Apple verify: no transactions in this env, trying fallback', { transactionId, env });
          continue;
        }
        const decoded = await verifier.verifyAndDecodeTransaction(signedTx);
        if (env !== (primaryIsProd ? 'Production' : 'Sandbox')) {
          // Apple 공식 권장 패턴: 프로덕션 서버는 21007 시 Sandbox 폴백을 해야 한다.
          // (Apple 리뷰어가 Sandbox 계정으로 결제하기 때문) — 그러나 운영 가시성을
          // 위해 prod-accepts-sandbox 케이스는 warn 으로 기록한다.
          if (primaryIsProd && env === 'Sandbox') {
            logger.warn('Apple verify: PRODUCTION server accepted SANDBOX transaction (Apple review or tester account)', {
              transactionId,
              originalTransactionId: decoded.originalTransactionId,
              bundleId: APPLE_BUNDLE_ID,
            });
          } else {
            logger.info('Apple verify: succeeded via fallback env', { transactionId, env });
          }
        }
        return this.toVerified(decoded);
      } catch (error) {
        lastError = error;
        const msg = error instanceof Error ? error.message : String(error);
        // 404/Not found 류 에러는 다른 환경으로 폴백, 기타 에러도 한번 더 시도
        logger.warn('Apple verify attempt failed, will try fallback env if available', {
          transactionId, env, error: msg,
        });
      }
    }

    logger.error('Apple verifyTransactionId failed in both envs', {
      transactionId,
      bundleId: APPLE_BUNDLE_ID,
      defaultEnv: APPLE_ENVIRONMENT,
      error: lastError instanceof Error ? lastError.message : String(lastError),
    });
    if (lastError instanceof AppError) throw lastError;
    throw new AppError('Apple 영수증 검증에 실패했습니다.', { statusCode: 400, code: 'APPLE_VERIFY_FAILED' });
  }

  /**
   * Verify a base64 receipt (legacy StoreKit 1 / appStoreReceipt fallback).
   * Extracts a transactionId then calls verifyTransactionId.
   */
  async verifyReceipt(receiptBase64: string): Promise<AppleVerifiedTransaction> {
    const receiptUtil = new ReceiptUtility();
    const txId = receiptUtil.extractTransactionIdFromAppReceipt(receiptBase64);
    if (!txId) {
      throw new AppError('영수증에서 거래 ID를 추출할 수 없습니다.', { statusCode: 400, code: 'APPLE_RECEIPT_INVALID' });
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
    if (!this.verifierProd || !this.verifierSandbox) {
      throw new AppError('Apple provider not configured', {
        statusCode: 503,
        code: 'APPLE_NOT_CONFIGURED',
      });
    }

    // Sandbox/Production 모두 시도 (Apple 웹훅은 두 환경 모두에서 전송됨)
    const primaryIsProd = APPLE_ENVIRONMENT === Environment.PRODUCTION;
    const verifiers = primaryIsProd
      ? [this.verifierProd, this.verifierSandbox]
      : [this.verifierSandbox, this.verifierProd];

    let payload: ResponseBodyV2DecodedPayload | null = null;
    let activeVerifier: SignedDataVerifier | null = null;
    let lastErr: unknown = null;
    for (const v of verifiers) {
      try {
        payload = await v.verifyAndDecodeNotification(signedPayload);
        activeVerifier = v;
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!payload || !activeVerifier) {
      throw lastErr instanceof Error ? lastErr : new AppError('Apple notification verification failed', { statusCode: 400, code: 'APPLE_NOTIFICATION_INVALID' });
    }

    let transaction: JWSTransactionDecodedPayload | undefined;
    let renewalInfo: JWSRenewalInfoDecodedPayload | undefined;

    const data = payload.data;
    if (data?.signedTransactionInfo) {
      transaction = await activeVerifier.verifyAndDecodeTransaction(data.signedTransactionInfo);
    }
    if (data?.signedRenewalInfo) {
      renewalInfo = await activeVerifier.verifyAndDecodeRenewalInfo(data.signedRenewalInfo);
    }

    return { payload, transaction, renewalInfo };
  }

  private toVerified(decoded: JWSTransactionDecodedPayload): AppleVerifiedTransaction {
    if (!decoded.originalTransactionId || !decoded.transactionId || !decoded.productId) {
      throw new AppError('Apple 영수증 데이터가 올바르지 않습니다.', {
        statusCode: 400,
        code: 'APPLE_TX_INVALID',
      });
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
