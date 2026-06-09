/// <reference types="cordova-plugin-purchase" />
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import { apiRequest } from '@/lib/api';
import {
  _globalListenersAttached,
  _setGlobalListenersAttached,
  _isTransactionProcessed,
  _markTransactionProcessed,
  extractAppleReceiptBase64,
} from './useAppleIAP';
import { findOwnedAppleTransactionId } from '@/lib/appleReceipt';

declare const CdvPurchase: {
  store: unknown;
  Platform: { APPLE_APPSTORE: string };
  ProductType: { PAID_SUBSCRIPTION: string };
};

// 신규 구매는 subscription03 만 쓰지만, 레거시 상품 ID 도 등록해야 과거(subscription01/02)
// 구독자의 자동복구(restorePurchases)가 그들의 구독을 감지할 수 있다.
const APPLE_PRODUCT_IDS = ['subscription03', 'subscription02', 'subscription01'];

type StoreInstance = {
  register: (products: Array<{ id: string; type: string; platform: string }>) => void;
  initialize: (platforms?: string[]) => Promise<unknown>;
  restorePurchases: () => Promise<unknown>;
  when: () => {
    approved: (cb: (tx: TransactionLike) => void) => unknown;
    verified?: (cb: (receipt: unknown) => void) => unknown;
    finished?: (cb: (tx: TransactionLike) => void) => unknown;
  };
  error: (cb: (err: unknown) => void) => void;
};

type TransactionLike = {
  transactionId?: string;
  finish?: () => Promise<unknown>;
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// 앱 세션당 한 번만 실행 (컴포넌트 재마운트로 중복 실행 방지)
let _startupRecoveryRan = false;
// approved 콜백이 동시에 여러 번 실행되는 것 방지
let _recovering = false;

/**
 * iOS 앱 시작 시 StoreKit 미완료 거래를 자동 복구하는 훅.
 *
 * 문제: store.initialize() 를 lazy (결제 버튼 클릭 시점) 로만 호출하기 때문에,
 * 결제 완료 후 앱이 종료/충돌되면 StoreKit 의 pending approved 이벤트가 누락됨.
 * StoreKit 은 transaction.finish() 가 호출될 때까지 거래를 영구 보관하며,
 * store.initialize() 가 호출될 때마다 approved 이벤트를 재발행(replay) 한다.
 *
 * 해결: 로그인 후 (ProtectedRoute 안) store.initialize() 를 조용히 호출해
 * 미완료 거래를 자동 처리하고, 이어서 store.restorePurchases() 를 호출해
 * 이미 소유한(과거에 구매했지만 서버 DB 에 반영되지 않은) 활성 구독을 능동적으로
 * 끌어와 서버에 등록한다. 즉, 사용자가 "구독 복원" 버튼을 누르지 않아도 앱 재실행만으로
 * 구독이 자동 반영된다. Apple 리뷰 sandbox 에러 팝업을 피하기 위해
 * 에러는 suppressed 처리하고, 지연(delay) 을 두어 앱이 완전히 초기화된 후 실행한다.
 *
 * ⚠️ restorePurchases() 는 호출할 때마다 소유 구독에 대해 approved 이벤트를 재발행한다.
 * 따라서 이미 활성 구독이 서버 DB 에 있는 경우엔 (매 실행마다 불필요한 verify-receipt 호출과
 * /payment/success 이동이 발생하지 않도록) 복구 자체를 건너뛴다.
 *
 * ⚠️ ProtectedRoute 안에서만 호출해야 한다 (인증 후 실행 보장).
 */
export function useAppleIAPStartupRecovery() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') return;
    if (_startupRecoveryRan) return;
    _startupRecoveryRan = true;

    const navigateFn = navigate;
    const qc = queryClient;

    (async () => {
      try {
        // 앱 완전 초기화 대기 — sandbox 에러 팝업 방지 (Apple 리뷰 거절 회피)
        await sleep(3000);

        if (typeof CdvPurchase === 'undefined') {
          console.log('[IAP recovery] CdvPurchase not available, skipping');
          return;
        }

        // 이미 활성 구독이 서버 DB 에 있으면 복구 불필요.
        // restorePurchases() 는 매 실행마다 approved 를 재발행하므로,
        // 활성 구독 보유 시 호출하면 불필요한 verify-receipt / 화면이동이 반복된다.
        try {
          const subsRes = await apiRequest<{ data: { subscriptions: Array<{ status?: string; endDate?: string }> } }>(
            '/payments/subscriptions'
          );
          const subs = subsRes?.data?.subscriptions ?? [];
          const now = Date.now();
          const hasActive = subs.some(
            (s) =>
              s.status === 'active' ||
              (s.status === 'cancelled' && s.endDate && new Date(s.endDate).getTime() >= now)
          );
          if (hasActive) {
            console.log('[IAP recovery] active subscription already present in DB, skipping restore');
            return;
          }
        } catch (e) {
          // 구독 조회 실패 시에도 복구는 시도한다 (서버 일시 오류 등)
          console.warn('[IAP recovery] subscription status check failed, proceeding with restore:', e);
        }

        const store = CdvPurchase.store as StoreInstance;
        const Platform = CdvPurchase.Platform;
        const ProductType = CdvPurchase.ProductType;

        store.register(
          APPLE_PRODUCT_IDS.map((id) => ({
            id,
            type: ProductType.PAID_SUBSCRIPTION,
            platform: Platform.APPLE_APPSTORE,
          }))
        );

        // ⚠️ 이미 완료처리(acknowledged)된 기존 자동갱신 구독은 restorePurchases() 후에도
        // approved 가 재발화하지 않는다. 그런 구독을 자동 복구하려면 localReceipts 에서
        // 거래ID 를 직접 읽어 서버 verify-receipt 로 보내야 한다. (approved 리스너만으로는
        // "0건" 문제가 해결되지 않는다.)
        const recoverOwnedFromReceipts = async (): Promise<void> => {
          const deadline = Date.now() + 6000;
          // payload({transactionId} 또는 {receipt})로 서버 verify-receipt 를 재시도한다.
          const verifyOnce = async (
            payload: { transactionId: string } | { receipt: string },
          ): Promise<boolean> => {
            const RETRY_DELAYS_MS = [1500, 3000, 5000];
            for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
              try {
                const data = await apiRequest<{ success?: boolean }>(
                  '/payments/apple/verify-receipt',
                  { method: 'POST', body: JSON.stringify(payload) }
                );
                if (data?.success) return true;
              } catch (err) {
                const anyErr = err as { code?: string; status?: number };
                const retryable =
                  anyErr?.code === 'APPLE_PERSIST_FAILED_RETRY' ||
                  anyErr?.status === 503 ||
                  anyErr?.status === 502 ||
                  anyErr?.status === undefined;
                if (!retryable) break;
              }
              if (attempt < RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[attempt]);
            }
            return false;
          };
          while (Date.now() < deadline) {
            const txId = findOwnedAppleTransactionId(store, APPLE_PRODUCT_IDS);
            // ⚠️ CdvPurchase v13 iOS 는 앱 번들 영수증을 "appstore.application" 으로 줄 수 있는데
            //   이는 App Store Server API 에 사용할 수 없으므로 base64 영수증 경로로 우회한다.
            const hasRealTxId = !!txId && txId !== 'appstore.application';
            if (hasRealTxId && _isTransactionProcessed(txId as string)) return;
            const receiptB64 = hasRealTxId ? null : extractAppleReceiptBase64(store as any);
            if (hasRealTxId || receiptB64) {
              if (_recovering) return; // approved 경로가 처리 중 → 중복 방지
              _recovering = true;
              try {
                const payload = hasRealTxId
                  ? { transactionId: txId as string }
                  : { receipt: receiptB64 as string };
                console.log(
                  '[IAP recovery] owned subscription found in receipts, verifying via',
                  hasRealTxId ? `txId ${txId}` : 'app receipt base64',
                );
                const verified = await verifyOnce(payload);
                if (verified) {
                  // 실제 txId 를 알 때만 영구 처리표시 (영수증 경로는 서버가 추출 전이라 표시하지 않음)
                  if (hasRealTxId) _markTransactionProcessed(txId as string);
                  await qc.invalidateQueries({ queryKey: ['subscriptions'] });
                  await qc.invalidateQueries({ queryKey: ['user', 'me'] });
                  console.log('[IAP recovery] owned subscription recovered from receipts');
                  navigateFn('/payment/success', { replace: true });
                } else {
                  console.warn('[IAP recovery] receipt-based verify failed');
                }
              } finally {
                _recovering = false;
              }
              return;
            }
            await sleep(700);
          }
        };

        // 리스너 중복 등록 방지: useAppleIAP 와 공유하는 모듈 레벨 플래그 확인
        if (_globalListenersAttached) {
          console.log('[IAP recovery] listeners already attached by purchase flow, skipping registration');
          // initialize() 로 pending 거래 replay + restorePurchases() 로 소유 구독 능동 조회.
          // 기존 (purchase flow) approved 리스너가 verify-receipt 를 처리한다.
          await store.initialize([Platform.APPLE_APPSTORE]);
          try {
            await store.restorePurchases();
          } catch (e) {
            console.warn('[IAP recovery] restorePurchases failed (suppressed):', e);
          }
          // approved 가 안 뜨는 기존(acknowledged) 구독은 영수증에서 직접 복구
          await recoverOwnedFromReceipts();
          console.log('[IAP recovery] store initialized + restorePurchases (listeners re-used from purchase flow)');
          return;
        }
        _setGlobalListenersAttached(true);

        // approved 리스너: pending 거래 발견 시 서버에 verify-receipt 요청
        store.when().approved(async (tx: TransactionLike) => {
          if (_recovering) {
            console.log('[IAP recovery] already recovering, skipping duplicate approved event');
            return;
          }
          _recovering = true;
          try {
            const transactionId = tx.transactionId;
            if (!transactionId) {
              console.warn('[IAP recovery] approved transaction has no transactionId');
              return;
            }
            // 같은 세션에서 이미 처리한 거래는 건너뜀 (initialize replay + restorePurchases 중복 방지)
            // ⚠️ "appstore.application" 은 앱 영수증 placeholder 라 거래 식별자가 아니다.
            //   이 값으로는 단축경로를 타지 않고 매번 서버 검증을 받는다.
            if (transactionId !== 'appstore.application' && _isTransactionProcessed(transactionId)) {
              console.log('[IAP recovery] transaction already processed this session, finishing & skipping:', transactionId);
              await tx.finish?.();
              return;
            }

            console.log('[IAP recovery] pending transaction found, verifying:', transactionId);

            // CdvPurchase v13 iOS는 앱 번들 영수증을 "appstore.application" ID로 전달한다.
            // App Store Server API 에서 이 ID를 사용할 수 없으므로, base64 영수증을 보낸다.
            const isAppReceipt = transactionId === 'appstore.application';
            const receiptBase64 = isAppReceipt
              ? extractAppleReceiptBase64(store as any)
              : null;

            // 서버 verify-receipt 재시도 (503/네트워크 오류 시)
            const RETRY_DELAYS_MS = [1500, 3000, 5000];
            let verified = false;
            let lastError: unknown = null;

            for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
              try {
                const data = await apiRequest<{ success?: boolean }>(
                  '/payments/apple/verify-receipt',
                  {
                    method: 'POST',
                    body: JSON.stringify(
                      receiptBase64 ? { receipt: receiptBase64 } : { transactionId }
                    ),
                  }
                );
                if (data?.success) {
                  verified = true;
                  break;
                }
                lastError = new Error('서버 검증 응답이 올바르지 않습니다.');
              } catch (err) {
                lastError = err;
                const anyErr = err as { code?: string; status?: number };
                const retryable =
                  anyErr?.code === 'APPLE_PERSIST_FAILED_RETRY' ||
                  anyErr?.status === 503 ||
                  anyErr?.status === 502 ||
                  anyErr?.status === undefined; // 네트워크 오류
                if (!retryable) break;
              }
              if (attempt < RETRY_DELAYS_MS.length) {
                await sleep(RETRY_DELAYS_MS[attempt]);
              }
            }

            if (verified) {
              // StoreKit 에 거래 완료 알림 → pending 큐에서 제거
              await tx.finish?.();
              // 실제 거래ID 만 영구 처리표시 (placeholder 는 단축경로 오용 방지를 위해 제외)
              if (transactionId !== 'appstore.application') _markTransactionProcessed(transactionId);
              // 구독 상태 캐시 무효화 (실제 캐시 키: ['user', 'me'], ['subscriptions'])
              await qc.invalidateQueries({ queryKey: ['subscriptions'] });
              await qc.invalidateQueries({ queryKey: ['user', 'me'] });
              console.log('[IAP recovery] pending transaction recovered successfully:', transactionId);
              navigateFn('/payment/success', { replace: true });
            } else {
              const msg = lastError instanceof Error ? lastError.message : String(lastError);
              console.warn('[IAP recovery] verify failed for pending transaction:', transactionId, msg);
            }
          } catch (e) {
            console.error('[IAP recovery] error handling approved transaction:', e);
          } finally {
            _recovering = false;
          }
        });

        // startup 중 store 에러는 suppressed (sandbox 에러 팝업 방지)
        store.error((err: unknown) => {
          console.warn('[IAP recovery] store error (suppressed during startup):', err);
        });

        await store.initialize([Platform.APPLE_APPSTORE]);
        // restorePurchases() 로 이미 소유한 활성 구독을 능동 조회 → approved 재발행 →
        // 위 approved 리스너가 verify-receipt 로 서버에 등록. (initialize 는 미완료 거래만 replay)
        try {
          await store.restorePurchases();
        } catch (e) {
          console.warn('[IAP recovery] restorePurchases failed (suppressed):', e);
        }
        // approved 가 안 뜨는 기존(acknowledged) 구독은 영수증에서 직접 복구
        await recoverOwnedFromReceipts();
        console.log('[IAP recovery] store initialized + restorePurchases called');

      } catch (e) {
        // startup recovery 실패는 조용히 처리 — 사용자에게 노출하지 않음
        console.warn('[IAP recovery] startup initialization failed (suppressed):', e);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
