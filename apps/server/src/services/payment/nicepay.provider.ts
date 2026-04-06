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
      (process.env.NICEPAY_TEST_MODE || '').toUpperCase() === 'TRUE' || !this.clientId;

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
      logger.info('NicePay approval response FULL', {
        tid,
        httpStatus: response.status,
        responseBody: JSON.stringify(data),
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
