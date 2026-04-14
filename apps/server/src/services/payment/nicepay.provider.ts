import { logger } from '../../config/logger';

export interface NicePayPaymentRequest {
  amount: number;
  orderId: string;
  goodsName: string;
  buyerName?: string;
  buyerEmail?: string;
  buyerTel?: string;
  returnUrl?: string;
  notifyUrl?: string;
}

export interface NicePayPaymentResponse {
  success: boolean;
  resultCode?: string;
  resultMsg?: string;
  tid?: string;
  orderId?: string;
  amount?: number;
  payMethod?: string;
  authDate?: string;
  cardCode?: string;
  cardName?: string;
  cardNo?: string;
  errorCode?: string;
  errorMsg?: string;
}

export class NicePayProvider {
  private clientId: string;
  private secretKey: string;
  private isTestMode: boolean;
  private approvalBaseUrl: string;

  constructor() {
    this.clientId = process.env.NICEPAY_MERCHANT_ID || '';
    this.secretKey = process.env.NICEPAY_API_SECRET || '';
    this.isTestMode =
      (process.env.NICEPAY_TEST_MODE || '').toUpperCase() === 'TRUE'
      || !this.clientId
      || this.clientId.startsWith('S2_');

    this.approvalBaseUrl = this.isTestMode
      ? 'https://sandbox-api.nicepay.co.kr'
      : 'https://api.nicepay.co.kr';

    if (!this.clientId || !this.secretKey) {
      logger.warn('Nice Payments credentials not fully configured');
    }

    logger.info('Nice Payments provider initialized', {
      isTestMode: this.isTestMode,
      hasClientId: !!this.clientId,
      approvalBaseUrl: this.approvalBaseUrl,
    });
  }

  getClientId(): string {
    return this.clientId;
  }

  getIsTestMode(): boolean {
    return this.isTestMode;
  }

  async approvePayment(tid: string, amount: number): Promise<NicePayPaymentResponse> {
    try {
      logger.info('Approving NicePay payment', { tid, amount, isTestMode: this.isTestMode });

      const authHeader = `Basic ${Buffer.from(`${this.clientId}:${this.secretKey}`).toString('base64')}`;

      const response = await fetch(`${this.approvalBaseUrl}/v1/payments/${tid}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify({ amount: Math.round(amount) }),
      });

      const data = (await response.json()) as Record<string, unknown>;
      logger.info('NicePay approval response', {
        status: response.status,
        resultCode: data.resultCode,
        resultMsg: data.resultMsg,
        tid: data.tid,
        orderId: data.orderId,
        amount: data.amount,
        isTestMode: this.isTestMode,
      });

      const resultCode = data.resultCode as string | undefined;

      if (resultCode === '0000') {
        return {
          success: true,
          resultCode: resultCode || '',
          resultMsg: (data.resultMsg || '결제 성공') as string,
          tid: (data.tid || tid) as string,
          orderId: (data.orderId) as string | undefined,
          amount: (data.amount || amount) as number,
          payMethod: (data.payMethod) as string | undefined,
          authDate: (data.authDate) as string | undefined,
          cardCode: (data.cardCode) as string | undefined,
          cardName: (data.cardName) as string | undefined,
          cardNo: (data.cardNo) as string | undefined,
        };
      } else {
        return {
          success: false,
          resultCode: resultCode || '',
          resultMsg: (data.resultMsg || '결제 실패') as string,
          errorCode: (data.resultCode) as string | undefined,
          errorMsg: (data.resultMsg) as string | undefined,
        };
      }
    } catch (error) {
      logger.error('NicePay approval failed', { error, tid });
      return {
        success: false,
        errorCode: 'NETWORK_ERROR',
        errorMsg: '결제 승인 중 오류가 발생했습니다.',
      };
    }
  }

  async issueBillingKey(authToken: string, tid: string, orderId: string, amount: number): Promise<NicePayPaymentResponse & { bid?: string }> {
    try {
      const requestUrl = `${this.approvalBaseUrl}/v1/payments/${tid}`;

      logger.info({
        url: requestUrl,
        tid,
        orderId,
        amount: Math.round(amount),
        isTestMode: this.isTestMode,
        clientId: this.clientId,
        authTokenLength: authToken?.length || 0,
      }, 'Issuing NicePay billing key - REQUEST');

      const authHeader = `Basic ${Buffer.from(`${this.clientId}:${this.secretKey}`).toString('base64')}`;

      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify({
          amount: Math.round(amount),
        }),
      });

      const data = (await response.json()) as Record<string, unknown>;
      const responseKeys = Object.keys(data);
      logger.info({
        httpStatus: response.status,
        responseKeys: responseKeys.join(', '),
        resultCode: data.resultCode,
        resultMsg: data.resultMsg,
        hasBid: !!data.bid,
        bid: data.bid ? '***masked***' : 'none',
        tid: data.tid,
        orderId: data.orderId,
        cardName: data.cardName,
        cardNo: data.cardNo,
        cardCode: data.cardCode,
        payMethod: data.payMethod,
      }, 'NicePay billing key issue - RESPONSE');

      const resultCode = data.resultCode as string | undefined;

      if (resultCode === '0000') {
        const cardData = data.card as Record<string, unknown> | undefined;
        const bidValue = (data.bid || cardData?.bid) as string | undefined;

        logger.info({
          bidFromResponse: data.bid || 'none',
          bidFromCard: cardData?.bid || 'none',
          hasBid: !!bidValue,
          tid: data.tid || tid,
          status: data.status,
        }, 'NicePay billing key - checking bid in response');

        return {
          success: true,
          resultCode: resultCode || '',
          resultMsg: (data.resultMsg || '결제 승인 성공') as string,
          bid: bidValue,
          tid: (data.tid || tid) as string,
          orderId: (data.orderId || orderId) as string,
          amount: (data.amount || amount) as number,
          cardCode: (cardData?.cardCode || data.cardCode) as string | undefined,
          cardName: (cardData?.cardName || data.cardName) as string | undefined,
          cardNo: (cardData?.cardNum || data.cardNo) as string | undefined,
        };
      } else {
        return {
          success: false,
          resultCode: resultCode || '',
          resultMsg: (data.resultMsg || '빌링키 발급 실패') as string,
          errorCode: (data.resultCode) as string | undefined,
          errorMsg: (data.resultMsg) as string | undefined,
        };
      }
    } catch (error) {
      logger.error({ error, orderId }, 'NicePay billing key issue failed');
      return {
        success: false,
        errorCode: 'NETWORK_ERROR',
        errorMsg: '빌링키 발급 중 오류가 발생했습니다.',
      };
    }
  }

  async approveBillingKey(bid: string): Promise<NicePayPaymentResponse> {
    try {
      logger.info('Approving NicePay billing key', { bid: '***masked***', isTestMode: this.isTestMode });

      const authHeader = `Basic ${Buffer.from(`${this.clientId}:${this.secretKey}`).toString('base64')}`;

      const response = await fetch(`${this.approvalBaseUrl}/v1/subscribe/${bid}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify({}),
      });

      const data = (await response.json()) as Record<string, unknown>;
      logger.info('NicePay billing key approval response', {
        status: response.status,
        resultCode: data.resultCode,
        resultMsg: data.resultMsg,
        cardName: data.cardName,
      });

      const resultCode = data.resultCode as string | undefined;

      if (resultCode === '0000') {
        return {
          success: true,
          resultCode: resultCode || '',
          resultMsg: (data.resultMsg || '빌링키 등록 성공') as string,
          tid: (data.tid) as string | undefined,
          cardCode: (data.cardCode) as string | undefined,
          cardName: (data.cardName) as string | undefined,
          cardNo: (data.cardNo) as string | undefined,
        };
      } else {
        return {
          success: false,
          resultCode: resultCode || '',
          resultMsg: (data.resultMsg || '빌링키 등록 실패') as string,
          errorCode: (data.resultCode) as string | undefined,
          errorMsg: (data.resultMsg) as string | undefined,
        };
      }
    } catch (error) {
      logger.error('NicePay billing key approval failed', { error });
      return {
        success: false,
        errorCode: 'NETWORK_ERROR',
        errorMsg: '빌링키 등록 중 오류가 발생했습니다.',
      };
    }
  }

  async payWithBillingKey(
    bid: string,
    orderId: string,
    amount: number,
    goodsName: string
  ): Promise<NicePayPaymentResponse> {
    try {
      logger.info('Charging with billing key', { orderId, amount, isTestMode: this.isTestMode });

      const authHeader = `Basic ${Buffer.from(`${this.clientId}:${this.secretKey}`).toString('base64')}`;

      const response = await fetch(`${this.approvalBaseUrl}/v1/subscribe/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify({
          encData: bid,
          orderId,
          amount: Math.round(amount),
          goodsName,
          useShopInterest: false,
        }),
      });

      const data = (await response.json()) as Record<string, unknown>;
      logger.info('NicePay billing payment response', {
        status: response.status,
        resultCode: data.resultCode,
        resultMsg: data.resultMsg,
        tid: data.tid,
        orderId: data.orderId,
        amount: data.amount,
      });

      const resultCode = data.resultCode as string | undefined;

      if (resultCode === '0000') {
        return {
          success: true,
          resultCode: resultCode || '',
          resultMsg: (data.resultMsg || '결제 성공') as string,
          tid: (data.tid) as string | undefined,
          orderId: (data.orderId) as string | undefined,
          amount: (data.amount || amount) as number,
          cardCode: (data.cardCode) as string | undefined,
          cardName: (data.cardName) as string | undefined,
          cardNo: (data.cardNo) as string | undefined,
        };
      } else {
        return {
          success: false,
          resultCode: resultCode || '',
          resultMsg: (data.resultMsg || '결제 실패') as string,
          errorCode: (data.resultCode) as string | undefined,
          errorMsg: (data.resultMsg) as string | undefined,
        };
      }
    } catch (error) {
      logger.error('NicePay billing payment failed', { error, orderId });
      return {
        success: false,
        errorCode: 'NETWORK_ERROR',
        errorMsg: '빌링키 결제 중 오류가 발생했습니다.',
      };
    }
  }

  async cancelBillingKey(bid: string): Promise<NicePayPaymentResponse> {
    try {
      logger.info('Cancelling NicePay billing key', { isTestMode: this.isTestMode });

      const authHeader = `Basic ${Buffer.from(`${this.clientId}:${this.secretKey}`).toString('base64')}`;

      const response = await fetch(`${this.approvalBaseUrl}/v1/subscribe/${bid}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
      });

      const data = (await response.json()) as Record<string, unknown>;
      const resultCode = data.resultCode as string | undefined;

      if (resultCode === '0000') {
        return {
          success: true,
          resultCode: resultCode || '',
          resultMsg: (data.resultMsg || '빌링키 해지 성공') as string,
        };
      } else {
        return {
          success: false,
          resultCode: resultCode || '',
          errorCode: (data.resultCode) as string | undefined,
          errorMsg: (data.resultMsg) as string | undefined,
        };
      }
    } catch (error) {
      logger.error('NicePay billing key cancellation failed', { error });
      return {
        success: false,
        errorCode: 'NETWORK_ERROR',
        errorMsg: '빌링키 해지 중 오류가 발생했습니다.',
      };
    }
  }

  async cancelPayment(
    tid: string,
    amount: number,
    reason: string
  ): Promise<NicePayPaymentResponse> {
    try {
      logger.info('Cancelling NicePay payment', { tid, amount, isTestMode: this.isTestMode });

      const authHeader = `Basic ${Buffer.from(`${this.clientId}:${this.secretKey}`).toString('base64')}`;

      const response = await fetch(`${this.approvalBaseUrl}/v1/payments/${tid}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify({
          reason,
          cancelAmt: amount,
        }),
      });

      const data = (await response.json()) as Record<string, unknown>;
      const resultCode = data.resultCode as string | undefined;

      if (resultCode === '0000') {
        return {
          success: true,
          resultCode: resultCode || '',
          resultMsg: (data.resultMsg || '취소 성공') as string,
          tid: (data.tid || tid) as string,
          amount,
        };
      } else {
        return {
          success: false,
          resultCode: resultCode || '',
          resultMsg: (data.resultMsg || '취소 실패') as string,
          errorCode: (data.resultCode) as string | undefined,
          errorMsg: (data.resultMsg) as string | undefined,
        };
      }
    } catch (error) {
      logger.error('NicePay cancellation failed', { error, tid });
      return {
        success: false,
        errorCode: 'NETWORK_ERROR',
        errorMsg: '결제 취소 중 오류가 발생했습니다.',
      };
    }
  }
}

export const nicePayProvider = new NicePayProvider();
