/// <reference types="cordova-plugin-purchase" />
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import { apiRequest } from '@/lib/api';
import { _globalListenersAttached, _setGlobalListenersAttached } from './useAppleIAP';

declare const CdvPurchase: {
  store: unknown;
  Platform: { APPLE_APPSTORE: string };
  ProductType: { PAID_SUBSCRIPTION: string };
};

const APPLE_PRODUCT_ID = 'subscription03';

type StoreInstance = {
  register: (products: Array<{ id: string; type: string; platform: string }>) => void;
  initialize: (platforms?: string[]) => Promise<unknown>;
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
 * 미완료 거래를 자동 처리한다. Apple 리뷰 sandbox 에러 팝업을 피하기 위해
 * 에러는 suppressed 처리하고, 지연(delay) 을 두어 앱이 완전히 초기화된 후 실행한다.
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

        const store = CdvPurchase.store as StoreInstance;
        const Platform = CdvPurchase.Platform;
        const ProductType = CdvPurchase.ProductType;

        store.register([{
          id: APPLE_PRODUCT_ID,
          type: ProductType.PAID_SUBSCRIPTION,
          platform: Platform.APPLE_APPSTORE,
        }]);

        // 리스너 중복 등록 방지: useAppleIAP 와 공유하는 모듈 레벨 플래그 확인
        if (_globalListenersAttached) {
          console.log('[IAP recovery] listeners already attached by purchase flow, skipping registration');
          // store.initialize() 만 호출해 pending 거래를 기존 리스너로 replay
          await store.initialize([Platform.APPLE_APPSTORE]);
          console.log('[IAP recovery] store initialized (listeners re-used from purchase flow)');
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

            console.log('[IAP recovery] pending transaction found, verifying:', transactionId);

            // 서버 verify-receipt 재시도 (503/네트워크 오류 시)
            const RETRY_DELAYS_MS = [1500, 3000, 5000];
            let verified = false;
            let lastError: unknown = null;

            for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
              try {
                const data = await apiRequest<{ success?: boolean }>(
                  '/payments/apple/verify-receipt',
                  { method: 'POST', body: JSON.stringify({ transactionId }) }
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
        console.log('[IAP recovery] store initialized, pending transactions will be replayed');

      } catch (e) {
        // startup recovery 실패는 조용히 처리 — 사용자에게 노출하지 않음
        console.warn('[IAP recovery] startup initialization failed (suppressed):', e);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
