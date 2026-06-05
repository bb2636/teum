/// <reference types="cordova-plugin-purchase" />
import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { apiRequest } from '@/lib/api';

declare const CdvPurchase: {
  store: unknown;
  Platform: { APPLE_APPSTORE: string };
  ProductType: { PAID_SUBSCRIPTION: string };
  ErrorCode: { PAYMENT_CANCELLED: number };
};

const APPLE_PRODUCT_ID = 'subscription03';
// 신규 구매는 현행 상품(subscription03)만 사용하지만, 과거 빌드에서 subscription01/02 로
// 결제한 기존 구독자는 그 상품 ID 로 자동갱신을 이어간다. 복원/자동복구가 그들의 구독을
// 감지하려면 StoreKit 에 레거시 상품 ID 도 함께 등록해야 한다(미등록 ID 의 거래는 무시됨).
const APPLE_PRODUCT_IDS = ['subscription03', 'subscription02', 'subscription01'];
const INIT_DELAY_MS = 1000;
const RETRY_DELAYS_MS = [1500, 2500];

type IAPError = { code?: number; message?: string };

type WhenChain = {
  approved: (cb: (transaction: TransactionLike) => void) => WhenChain;
  finished: (cb: (transaction: TransactionLike) => void) => WhenChain;
  verified: (cb: (receipt: unknown) => void) => WhenChain;
};

type StoreInstance = {
  register: (products: Array<{ id: string; type: string; platform: string }>) => void;
  initialize: (platforms?: string[]) => Promise<unknown>;
  update: () => Promise<unknown>;
  when: () => WhenChain;
  error: (cb: (err: IAPError) => void) => void;
  get: (productId: string) => ProductLike | undefined;
  order: (offer: OfferLike) => Promise<{ isError?: boolean; message?: string } | undefined>;
  restorePurchases: () => Promise<unknown>;
};

type OfferLike = { id: string };
type ProductLike = {
  id: string;
  title?: string;
  pricing?: { price?: string };
  getOffer: () => OfferLike | undefined;
};
type TransactionLike = {
  transactionId?: string;
  products?: Array<{ id: string }>;
  verify?: () => Promise<unknown>;
  finish?: () => Promise<unknown>;
};

export function isAppleIAPAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── 모듈 레벨 싱글턴 가드 ───────────────────────────────────────────────
// CdvPurchase.store 는 전역 싱글턴이므로 여러 컴포넌트(PaymentPage, PaymentHistoryPage,
// useAppleIAPStartupRecovery) 에서 useAppleIAP 가 마운트되어도 리스너는 한 번만 등록된다.
// ⚠️ useRef 대신 모듈 레벨 변수를 사용하는 이유:
//   useRef 는 컴포넌트 인스턴스마다 별도의 값을 가지므로, 두 컴포넌트가 동시에 마운트되면
//   두 인스턴스 모두 listenersAttached=false 로 시작해 리스너를 중복 등록한다.
// export: useAppleIAPStartupRecovery 가 같은 플래그를 공유해 중복 등록을 막는다.
export let _globalListenersAttached = false;
export function _setGlobalListenersAttached(v: boolean) { _globalListenersAttached = v; }

// ─── 거래 멱등 가드 (세션 단위) ──────────────────────────────────────────
// initialize() replay 와 restorePurchases() 가 같은 거래에 대해 approved 를 순차적으로
// 두 번 발행할 수 있다. (_recovering/verifyingRef 는 동시 실행만 막고 순차 중복은 못 막음)
// 검증·완료(finish)에 성공한 transactionId 를 기록해, 같은 세션에서 중복 verify-receipt /
// 중복 화면 이동을 방지한다. 실패한 거래는 기록하지 않아 재시도(다음 approved)가 가능하다.
const _processedTransactionIds = new Set<string>();
export function _isTransactionProcessed(id: string): boolean { return _processedTransactionIds.has(id); }
export function _markTransactionProcessed(id: string): void { _processedTransactionIds.add(id); }

// ─── Apple 앱 번들 영수증 추출 ───────────────────────────────────────────
// CdvPurchase v13 iOS는 앱 번들 영수증 처리 시 transaction.transactionId 를
// "appstore.application" 으로 반환한다. 이는 Apple App Store Server API의
// getTransactionHistory() 에 사용할 수 없는 값이다.
// 이 경우 store.localReceipts 에서 base64 앱 영수증을 꺼내 서버에 전달하면,
// 서버의 ReceiptUtility.extractTransactionIdFromAppReceipt() 가 실제 트랜잭션 ID를
// 추출해 App Store Server API 호출에 사용한다.
export function extractAppleReceiptBase64(store: StoreInstance): string | null {
  try {
    const storeAny = store as any;
    const receipts = storeAny?.localReceipts as
      | Array<{ platform: string; nativeData?: { appStoreReceipt?: string } }>
      | undefined;
    if (!receipts?.length) return null;
    const platformId = (CdvPurchase as any)?.Platform?.APPLE_APPSTORE ?? 'ios-appstore';
    const appleReceipt = receipts.find(
      (r) => r.platform === platformId || r.platform === 'ios-appstore',
    );
    return appleReceipt?.nativeData?.appStoreReceipt ?? null;
  } catch {
    return null;
  }
}

export function useAppleIAP() {
  const [pluginLoaded, setPluginLoaded] = useState(false);
  const [ready, setReady] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [product, setProduct] = useState<{ id: string; title: string; price: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const storeRef = useRef<StoreInstance | null>(null);
  const initPromiseRef = useRef<Promise<boolean> | null>(null);
  const initializedRef = useRef(false);
  const verifyingRef = useRef(false);
  // 복원 진행 중 verify 결과를 즉시 resolve 하기 위한 deferred
  const restoreVerifyDeferredRef = useRef<{
    resolve: (v: 'restored' | 'verify_failed') => void;
  } | null>(null);
  const mountedRef = useRef(true);

  const safeSet = useCallback(<T,>(setter: (v: T) => void, value: T) => {
    if (mountedRef.current) setter(value);
  }, []);

  // ⚠️ Apple 리뷰(iPad sandbox) 거절 회피:
  // 페이지 mount 시 자동 store.initialize() 호출은 sandbox 에서 빈번히 실패하고
  // 거기서 뜨는 에러 팝업이 거절 사유가 된다.
  // → 결제 버튼을 누른 직후에 init 을 시작한다 (lazy init).
  // 플러그인 로드 여부만 mount 시점에 확인한다.
  useEffect(() => {
    if (!isAppleIAPAvailable()) return;
    mountedRef.current = true;
    if (typeof CdvPurchase !== 'undefined') {
      safeSet(setPluginLoaded, true);
    }
    return () => {
      mountedRef.current = false;
    };
  }, [safeSet]);

  const tryFetchProduct = useCallback(async (store: StoreInstance): Promise<boolean> => {
    try {
      // store.update() 가 있으면 카탈로그를 강제 새로고침
      if (typeof store.update === 'function') {
        try {
          await store.update();
        } catch (e) {
          console.warn('[IAP] store.update failed (continuing):', e);
        }
      }
    } catch {
      // ignore
    }
    const p = store.get(APPLE_PRODUCT_ID);
    if (!p) return false;
    const offer = p.getOffer?.();
    console.log('[IAP] product found:', JSON.stringify({ id: p.id, title: p.title, price: p.pricing?.price, hasOffer: !!offer }));
    if (!offer) return false;
    safeSet(setProduct, {
      id: p.id,
      title: p.title || '월간 프리미엄',
      price: p.pricing?.price || '',
    });
    return true;
  }, [safeSet]);

  const doInit = useCallback(async (): Promise<boolean> => {
    if (!isAppleIAPAvailable()) return false;
    if (typeof CdvPurchase === 'undefined') {
      console.error('[IAP] CdvPurchase global is undefined');
      safeSet(setError, '결제 모듈을 불러올 수 없습니다.');
      return false;
    }
    safeSet(setPluginLoaded, true);
    safeSet(setInitializing, true);
    safeSet(setError, null);

    try {
      // iPad sandbox 동기화를 위한 초기 지연
      await sleep(INIT_DELAY_MS);

      const store = CdvPurchase.store as StoreInstance;
      const Platform = CdvPurchase.Platform;
      const ProductType = CdvPurchase.ProductType;

      console.log('[IAP] registering products:', APPLE_PRODUCT_IDS.join(', '));
      store.register(
        APPLE_PRODUCT_IDS.map((id) => ({
          id,
          type: ProductType.PAID_SUBSCRIPTION,
          platform: Platform.APPLE_APPSTORE,
        }))
      );

      // ⚠️ 리스너는 한 번만 등록 (재시도/재초기화 시 중복 등록 방지)
      // _globalListenersAttached: 모듈 레벨 가드 — useAppleIAPStartupRecovery 가 먼저
      // 리스너를 등록했더라도 여기서 중복 등록하지 않는다.
      if (!_globalListenersAttached) {
        _globalListenersAttached = true;
        store
        .when()
        .approved(async (transaction: TransactionLike) => {
          if (verifyingRef.current) return;
          verifyingRef.current = true;
          try {
            const transactionId = transaction.transactionId;
            if (!transactionId) {
              safeSet(setError, 'Apple 거래 ID를 가져오지 못했습니다.');
              safeSet(setPurchasing, false);
              // 복원 중이라면 실패로 즉시 종료
              restoreVerifyDeferredRef.current?.resolve('verify_failed');
              restoreVerifyDeferredRef.current = null;
              return;
            }
            // 같은 세션에서 이미 검증·완료한 거래는 재처리하지 않음
            // (initialize replay + restorePurchases 가 같은 거래를 순차로 재발행하는 경우)
            if (_isTransactionProcessed(transactionId)) {
              await transaction.finish?.();
              if (restoreVerifyDeferredRef.current) {
                restoreVerifyDeferredRef.current.resolve('restored');
                restoreVerifyDeferredRef.current = null;
              }
              safeSet(setPurchasing, false);
              return;
            }
            // CdvPurchase v13 iOS는 앱 번들 영수증을 "appstore.application" ID로 전달한다.
            // 이 값은 App Store Server API의 getTransactionHistory() 에 사용 불가하므로,
            // localReceipts 에서 base64 앱 영수증을 꺼내 서버로 전달한다.
            // 서버는 ReceiptUtility 로 실제 트랜잭션 ID를 추출해 처리한다.
            const isAppReceipt = transactionId === 'appstore.application';
            const receiptBase64 = isAppReceipt && storeRef.current
              ? extractAppleReceiptBase64(storeRef.current)
              : null;
            if (isAppReceipt && !receiptBase64) {
              console.warn('[IAP] appstore.application tx but no receipt found in localReceipts');
            }
            // ⚠️ Apple 결제는 이미 과금된 상태. 서버 등록만 실패한 경우
            // (APPLE_PERSIST_FAILED_RETRY 503 / 네트워크 오류) 사용자가 돈은 냈는데
            // 구독이 반영되지 않는 사고가 난다. 따라서 backoff 자동 재시도 한다.
            // 서버측 idempotency (originalTransactionId 기반) 가 있어 중복 등록되지 않는다.
            const VERIFY_RETRY_DELAYS_MS = [1500, 3000, 5000];
            let verified = false;
            let lastError: unknown = null;
            for (let attempt = 0; attempt <= VERIFY_RETRY_DELAYS_MS.length; attempt++) {
              if (!mountedRef.current) return;
              try {
                const data = await apiRequest<{ success?: boolean; data?: { success?: boolean } }>(
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
                lastError = new Error('서버 검증에 실패했습니다.');
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
              if (attempt < VERIFY_RETRY_DELAYS_MS.length) {
                safeSet(setError, `결제는 완료되었습니다. 구독 등록 중... (재시도 ${attempt + 1}/${VERIFY_RETRY_DELAYS_MS.length})`);
                await sleep(VERIFY_RETRY_DELAYS_MS[attempt]);
                if (!mountedRef.current) return;
              }
            }

            if (verified) {
              await transaction.finish?.();
              _markTransactionProcessed(transactionId);
              // 복원 흐름: deferred 가 결과를 받게 하고 navigate 는 호출측이 결정
              if (restoreVerifyDeferredRef.current) {
                restoreVerifyDeferredRef.current.resolve('restored');
                restoreVerifyDeferredRef.current = null;
              } else {
                window.location.href = '/payment/success';
              }
            } else {
              const message = lastError instanceof Error ? lastError.message : '서버 검증에 실패했습니다.';
              safeSet(setError, `${message} 앱을 재시작하면 자동으로 동기화됩니다. 결제는 정상 완료되었으며 중복 청구되지 않습니다.`);
              safeSet(setPurchasing, false);
              restoreVerifyDeferredRef.current?.resolve('verify_failed');
              restoreVerifyDeferredRef.current = null;
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : '검증 실패';
            safeSet(setError, message);
            safeSet(setPurchasing, false);
            restoreVerifyDeferredRef.current?.resolve('verify_failed');
            restoreVerifyDeferredRef.current = null;
          } finally {
            verifyingRef.current = false;
          }
        });

        const cancelledCode = CdvPurchase.ErrorCode?.PAYMENT_CANCELLED ?? 6777006;
        store.error((err: IAPError) => {
          console.error('[IAP] store.error:', JSON.stringify(err));
          if (err?.code === cancelledCode) {
            safeSet(setPurchasing, false);
            return;
          }
          // store init/load 단계의 에러는 inline 으로만 노출 (alert 금지: Apple 리뷰 거절 회피)
          safeSet(setError, '결제 정보를 불러오는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.');
          safeSet(setPurchasing, false);
        });
      } // end listenersAttachedRef guard

      console.log('[IAP] calling store.initialize...');
      await store.initialize([Platform.APPLE_APPSTORE]);

      storeRef.current = store;

      // 1차 fetch
      let found = await tryFetchProduct(store);

      // 실패 시 재시도 (지연 → update → get)
      for (let i = 0; !found && i < RETRY_DELAYS_MS.length; i++) {
        console.warn(`[IAP] product not found, retry #${i + 1} after ${RETRY_DELAYS_MS[i]}ms`);
        await sleep(RETRY_DELAYS_MS[i]);
        if (!mountedRef.current) return false;
        found = await tryFetchProduct(store);
      }

      if (found) {
        initializedRef.current = true;
        safeSet(setReady, true);
        safeSet(setError, null);
        return true;
      }

      // 모든 재시도 실패
      console.warn('[IAP] product NOT FOUND after retries');
      safeSet(setError, '결제 상품 정보를 불러올 수 없습니다. 인터넷 연결을 확인 후 다시 시도해주세요.');
      return false;
    } catch (err) {
      console.error('[IAP] init exception:', err);
      safeSet(setError, '결제 모듈 초기화에 실패했습니다.');
      return false;
    } finally {
      safeSet(setInitializing, false);
    }
  }, [safeSet, tryFetchProduct]);

  const ensureReady = useCallback(async (): Promise<boolean> => {
    if (initializedRef.current && storeRef.current) {
      const p = storeRef.current.get(APPLE_PRODUCT_ID);
      if (p?.getOffer?.()) return true;
      // 캐시는 있는데 offer 가 사라진 경우 재초기화 시도
      initializedRef.current = false;
    }
    if (!initPromiseRef.current) {
      initPromiseRef.current = doInit().finally(() => {
        // 실패한 경우엔 다음 호출에서 다시 시도할 수 있도록 promise 비움
        if (!initializedRef.current) {
          initPromiseRef.current = null;
        }
      });
    }
    return initPromiseRef.current;
  }, [doInit]);

  const purchase = useCallback(async () => {
    setError(null);
    if (purchasing || verifyingRef.current) return;

    // 결제 버튼 클릭 시점에 초기화 보장 (lazy init)
    const ok = await ensureReady();
    if (!ok) {
      // ensureReady 에서 이미 error state 세팅됨
      return;
    }

    const store = storeRef.current;
    if (!store) {
      setError('Apple 결제가 준비되지 않았습니다.');
      return;
    }
    const p = store.get(APPLE_PRODUCT_ID);
    const offer = p?.getOffer();
    if (!offer) {
      setError('구독 상품을 불러오지 못했습니다.');
      return;
    }

    // ⚠️ Apple IAP 는 결제 후 우리가 환불/취소할 수 없다.
    // 따라서 Apple StoreKit 결제창을 띄우기 *전*에 서버에서 활성구독 / productId 를 미리 검증해 결제 자체를 막는다.
    setPurchasing(true);
    try {
      await apiRequest('/payments/apple/precheck', {
        method: 'POST',
        body: JSON.stringify({ productId: APPLE_PRODUCT_ID }),
      });
    } catch (err) {
      const anyErr = err as { code?: string; message?: string; status?: number };
      const code = anyErr?.code;
      let message = anyErr?.message || '결제를 시작할 수 없습니다.';
      if (code === 'IDENTITY_VERIFICATION_REQUIRED') {
        message = '결제를 진행할 수 없습니다. 잠시 후 다시 시도해주세요.';
      } else if (code === 'ACTIVE_SUBSCRIPTION_EXISTS') {
        message = '이미 활성 구독이 있습니다. 기존 구독을 취소한 후 다시 시도해주세요.';
      } else if (code === 'INVALID_PRODUCT') {
        message = '현재 판매 중인 상품이 아닙니다. 앱을 최신 버전으로 업데이트해주세요.';
      } else if (code === 'APPLE_NOT_CONFIGURED') {
        message = '앱 내 결제가 일시적으로 사용 불가능합니다.';
      }
      setError(message);
      setPurchasing(false);
      return;
    }

    // store.order 가 unhandled rejection 을 던질 수 있으므로 try/catch 로 보호
    try {
      const result = await store.order(offer);
      if (result && result.isError) {
        setError(result.message || '결제에 실패했습니다.');
        setPurchasing(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '결제 요청에 실패했습니다.';
      setError(message);
      setPurchasing(false);
    }
  }, [purchasing, ensureReady]);

  // Apple App Store 가이드라인 3.1.1 준수:
  // 이전에 구매한 구독을 복원하기 위해 StoreKit restorePurchases 를 호출한다.
  // - 복원할 구독이 있으면 approved 콜백 → verify-receipt → /payment/success 로 자동 이동
  // - 없으면 'no_purchases' 반환
  const restore = useCallback(async (): Promise<'restored' | 'no_purchases' | 'failed'> => {
    setError(null);
    if (restoring || purchasing || verifyingRef.current) return 'failed';
    safeSet(setRestoring, true);
    try {
      const ok = await ensureReady();
      if (!ok) return 'failed';
      const store = storeRef.current;
      if (!store) return 'failed';

      // 이벤트 기반 deferred: approved → verify 성공/실패 시점에 resolve
      // 일정 시간 안에 approved 가 발화되지 않으면 'no_purchases' 로 간주
      const verifyOutcome = await new Promise<'restored' | 'verify_failed' | 'timeout'>((resolve) => {
        let settled = false;
        restoreVerifyDeferredRef.current = {
          resolve: (v) => {
            if (settled) return;
            settled = true;
            resolve(v);
          },
        };
        // restorePurchases 호출 자체가 실패할 수 있다
        store.restorePurchases().catch((e: unknown) => {
          console.error('[IAP] restorePurchases failed:', e);
          if (!settled) {
            settled = true;
            restoreVerifyDeferredRef.current = null;
            resolve('verify_failed');
          }
        });
        // 안전망 타임아웃: approved 가 발화 안 되면 복원할 항목이 없는 것으로 간주
        // (iOS StoreKit 은 복원 항목이 없으면 콜백 발화 없이 침묵)
        setTimeout(() => {
          if (!settled) {
            settled = true;
            restoreVerifyDeferredRef.current = null;
            resolve('timeout');
          }
        }, 8000);
      });

      if (verifyOutcome === 'restored') return 'restored';
      if (verifyOutcome === 'verify_failed') return 'failed';
      return 'no_purchases'; // timeout
    } finally {
      safeSet(setRestoring, false);
    }
  }, [ensureReady, restoring, purchasing, safeSet]);

  return {
    available: isAppleIAPAvailable() && pluginLoaded,
    ready,
    initializing,
    purchasing,
    restoring,
    product,
    error,
    purchase,
    restore,
    ensureReady,
  };
}
