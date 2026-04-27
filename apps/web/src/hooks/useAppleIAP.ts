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

const APPLE_PRODUCT_ID = 'subscription01';

type IAPError = { code?: number; message?: string };

type WhenChain = {
  approved: (cb: (transaction: TransactionLike) => void) => WhenChain;
  finished: (cb: (transaction: TransactionLike) => void) => WhenChain;
  verified: (cb: (receipt: unknown) => void) => WhenChain;
};

type StoreInstance = {
  register: (products: Array<{ id: string; type: string; platform: string }>) => void;
  initialize: (platforms?: string[]) => Promise<unknown>;
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

export function useAppleIAP() {
  const [pluginLoaded, setPluginLoaded] = useState(false);
  const [ready, setReady] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [product, setProduct] = useState<{ id: string; title: string; price: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const storeRef = useRef<StoreInstance | null>(null);
  const verifyingRef = useRef(false);
  const mountedRef = useRef(true);

  const safeSet = useCallback(<T,>(setter: (v: T) => void, value: T) => {
    if (mountedRef.current) setter(value);
  }, []);

  useEffect(() => {
    if (!isAppleIAPAvailable()) return;
    mountedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        console.log('[IAP] init start, bundleId expected: app.teum.com');
        if (typeof CdvPurchase === 'undefined') {
          console.error('[IAP] CdvPurchase global is undefined — plugin not loaded');
          return;
        }
        safeSet(setPluginLoaded, true);
        const store = CdvPurchase.store as StoreInstance;
        const Platform = CdvPurchase.Platform;
        const ProductType = CdvPurchase.ProductType;
        console.log('[IAP] CdvPurchase loaded, registering product:', APPLE_PRODUCT_ID);

        store.register([
          {
            id: APPLE_PRODUCT_ID,
            type: ProductType.PAID_SUBSCRIPTION,
            platform: Platform.APPLE_APPSTORE,
          },
        ]);

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
                return;
              }
              const data = await apiRequest<{ success?: boolean; data?: { success?: boolean } }>(
                '/api/payments/apple/verify-receipt',
                {
                  method: 'POST',
                  body: JSON.stringify({ transactionId }),
                }
              );
              if (data?.success) {
                await transaction.finish?.();
                window.location.href = '/payment/success';
              } else {
                safeSet(setError, '서버 검증에 실패했습니다.');
                safeSet(setPurchasing, false);
              }
            } catch (err) {
              const message = err instanceof Error ? err.message : '검증 실패';
              safeSet(setError, message);
              safeSet(setPurchasing, false);
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
          safeSet(setError, `[${err?.code ?? '?'}] ${err?.message || '결제에 실패했습니다.'}`);
          safeSet(setPurchasing, false);
        });

        console.log('[IAP] calling store.initialize...');
        const initResult = await store.initialize([Platform.APPLE_APPSTORE]);
        console.log('[IAP] initialize result:', JSON.stringify(initResult));

        if (cancelled) return;

        // Dump the entire products array
        const allProducts = (store as unknown as { products?: unknown[] }).products;
        console.log('[IAP] store.products length:', allProducts?.length ?? 'n/a');
        console.log('[IAP] store.products dump:', JSON.stringify(allProducts, null, 2));

        const p = store.get(APPLE_PRODUCT_ID);
        console.log('[IAP] store.get(' + APPLE_PRODUCT_ID + '):', JSON.stringify(p, null, 2));

        if (p) {
          const offer = p.getOffer?.();
          console.log('[IAP] product offer:', JSON.stringify(offer, null, 2));
          setProduct({
            id: p.id,
            title: p.title || '월간 프리미엄',
            price: p.pricing?.price || '',
          });
        } else {
          console.warn('[IAP] product NOT FOUND in store — App Store Connect did not return it');
          safeSet(setError, '구독 상품을 App Store에서 가져오지 못했습니다. (계약/번들ID/상품상태 확인)');
        }
        storeRef.current = store;
        setReady(true);
      } catch (err) {
        console.error('[IAP] init exception:', err);
        const message = err instanceof Error ? err.message : 'Apple IAP 초기화 실패';
        setError(message);
      }
    })();

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [safeSet]);

  const purchase = useCallback(async () => {
    setError(null);
    if (purchasing || verifyingRef.current) return;
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
    setPurchasing(true);
    const result = await store.order(offer);
    if (result && result.isError) {
      setError(result.message || '결제에 실패했습니다.');
      setPurchasing(false);
    }
  }, [purchasing]);

  const restore = useCallback(async () => {
    setError(null);
    const store = storeRef.current;
    if (!store) return;
    await store.restorePurchases();
  }, []);

  return { available: isAppleIAPAvailable() && pluginLoaded, ready, purchasing, product, error, purchase, restore };
}
