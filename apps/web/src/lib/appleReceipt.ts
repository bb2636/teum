/**
 * StoreKit 로컬 영수증(store.localReceipts)에서 우리 상품의 거래ID를 직접 추출한다.
 *
 * 왜 필요한가:
 *  cordova-plugin-purchase 의 `approved` 이벤트는 "아직 finish(acknowledge) 되지 않은"
 *  거래에 대해서만 발화한다. 그런데 이미 한 번 완료처리된 기존 자동갱신 구독은
 *  restorePurchases() 후에도 approved 가 다시 발화하지 않는 경우가 많다
 *  (StoreKit 이 이미 처리된 거래로 간주). 이때 영수증에는 거래가 남아 있으므로
 *  localReceipts 를 직접 스캔해 거래ID 를 꺼내 서버 verify-receipt 로 보낸다.
 *
 * store 타입을 unknown 으로 받는 이유: 두 훅(useAppleIAP / useAppleIAPStartupRecovery)이
 * 각자 다른 StoreInstance 타입을 쓰고, 플러그인 버전별로 영수증 shape 가 조금씩 다를 수 있어
 * 방어적으로 접근한다(형태가 달라도 null 로 안전하게 degrade).
 */
type AnyTx = {
  transactionId?: string;
  products?: Array<{ id?: string; productId?: string } | null | undefined>;
};
type AnyReceipt = { transactions?: AnyTx[] };
type AnyStore = { localReceipts?: AnyReceipt[] };

export function findOwnedAppleTransactionId(
  store: unknown,
  productIds: string[],
): string | null {
  const receipts = (store as AnyStore)?.localReceipts;
  if (!Array.isArray(receipts)) return null;

  let fallback: string | null = null;
  for (const receipt of receipts) {
    const txs = receipt?.transactions;
    if (!Array.isArray(txs)) continue;
    // 가장 최근 거래(배열 끝)부터 살펴 우리 상품과 매칭되는 거래ID 를 우선 반환한다.
    for (let i = txs.length - 1; i >= 0; i--) {
      const tx = txs[i];
      const txId = tx?.transactionId;
      if (!txId) continue;
      const pids = (tx.products || [])
        .map((p) => p?.id || p?.productId)
        .filter((x): x is string => typeof x === 'string' && x.length > 0);
      if (pids.some((pid) => productIds.includes(pid))) {
        return txId;
      }
      // 일부 플러그인 버전은 복원된 거래에 products 를 채우지 않는다 → 후보로만 보관.
      if (fallback === null && pids.length === 0) {
        fallback = txId;
      }
    }
  }
  return fallback;
}
