import { logger } from '../../config/logger';

/**
 * Nice Payments Provider
 * 
 * Handles Nice Payments API integration for payment processing.
 * Supports both test and production modes.
 */
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
  tid?: string; // Transaction ID
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
  private merchantId: string;
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;
  private isTestMode: boolean;

  constructor() {
    this.merchantId = process.env.NICEPAY_MERCHANT_ID || '';
    this.apiKey = process.env.NICEPAY_API_KEY || '';
    this.apiSecret = process.env.NICEPAY_API_SECRET || '';
    this.isTestMode = process.env.NICEPAY_TEST_MODE === 'true' || !this.merchantId;
    
    // Nice Payments API URLs
    // 테스트: https://webapi.nicepay.co.kr
    // 운영: https://webapi.nicepay.co.kr (동일하지만 merchantId로 구분)
    this.baseUrl = process.env.NICEPAY_BASE_URL || 'https://webapi.nicepay.co.kr';

    if (!this.isTestMode && (!this.merchantId || !this.apiKey || !this.apiSecret)) {
      logger.warn('Nice Payments credentials not fully configured, using test mode');
      this.isTestMode = true;
    }

    logger.info('Nice Payments provider initialized', {
      isTestMode: this.isTestMode,
      hasMerchantId: !!this.merchantId,
    });
  }

  /**
   * Process payment approval
   * 
   * @param request Payment request data
   * @returns Payment response with transaction details
   */
  async approvePayment(request: NicePayPaymentRequest): Promise<NicePayPaymentResponse> {
    try {
      logger.info('Processing Nice Payments approval', { orderId: request.orderId, isTestMode: this.isTestMode });

      // In test mode, simulate payment
      if (this.isTestMode) {
        return this.simulateTestPayment(request);
      }

      // Real Nice Payments API call
      const response = await fetch(`${this.baseUrl}/v1/payments/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64')}`,
        },
        body: JSON.stringify({
          merchantId: this.merchantId,
          orderId: request.orderId,
          amount: request.amount,
          goodsName: request.goodsName,
          buyerName: request.buyerName,
          buyerEmail: request.buyerEmail,
          buyerTel: request.buyerTel,
          returnUrl: request.returnUrl,
          notifyUrl: request.notifyUrl,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Nice Payments API error', {
          status: response.status,
          error: errorText,
        });
        throw new Error(`Nice Payments API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as Record<string, unknown>;

      // Parse Nice Payments response
      const resultCode = (data.resultCode || data.ResultCode) as string | undefined;
      if (resultCode === '0000' || resultCode === 'SUCCESS') {
        return {
          success: true,
          resultCode: resultCode || '',
          resultMsg: (data.resultMsg || data.ResultMsg || '결제 성공') as string,
          tid: (data.tid || data.TID) as string | undefined,
          orderId: (data.orderId || data.OrderID) as string | undefined,
          amount: (data.amount || data.Amount) as number | undefined,
          payMethod: (data.payMethod || data.PayMethod) as string | undefined,
          authDate: (data.authDate || data.AuthDate) as string | undefined,
          cardCode: (data.cardCode || data.CardCode) as string | undefined,
          cardName: (data.cardName || data.CardName) as string | undefined,
          cardNo: (data.cardNo || data.CardNo) as string | undefined,
        };
      } else {
        return {
          success: false,
          resultCode: resultCode || '',
          resultMsg: (data.resultMsg || data.ResultMsg || '결제 실패') as string,
          errorCode: (data.errorCode || data.ErrorCode) as string | undefined,
          errorMsg: (data.errorMsg || data.ErrorMsg) as string | undefined,
        };
      }
    } catch (error) {
      logger.error('Nice Payments approval failed', { error });
      throw error;
    }
  }

  /**
   * Cancel payment (refund)
   * 
   * @param tid Transaction ID
   * @param amount Amount to cancel (partial refund if less than original)
   * @param reason Cancel reason
   * @returns Cancel response
   */
  async cancelPayment(
    tid: string,
    amount: number,
    reason: string
  ): Promise<NicePayPaymentResponse> {
    try {
      logger.info('Processing Nice Payments cancellation', { tid, amount, isTestMode: this.isTestMode });

      // In test mode, simulate cancellation
      if (this.isTestMode) {
        return {
          success: true,
          resultCode: '0000',
          resultMsg: '취소 성공',
          tid,
          amount,
        };
      }

      // Real Nice Payments cancel API call
      const response = await fetch(`${this.baseUrl}/v1/payments/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64')}`,
        },
        body: JSON.stringify({
          merchantId: this.merchantId,
          tid,
          amount,
          reason,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Nice Payments cancel API error', {
          status: response.status,
          error: errorText,
        });
        throw new Error(`Nice Payments cancel API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as Record<string, unknown>;

      const resultCode = (data.resultCode || data.ResultCode) as string | undefined;
      if (resultCode === '0000' || resultCode === 'SUCCESS') {
        return {
          success: true,
          resultCode: resultCode || '',
          resultMsg: (data.resultMsg || data.ResultMsg || '취소 성공') as string,
          tid: (data.tid || data.TID) as string | undefined,
        };
      } else {
        return {
          success: false,
          resultCode: resultCode || '',
          resultMsg: (data.resultMsg || data.ResultMsg || '취소 실패') as string,
          errorCode: (data.errorCode || data.ErrorCode) as string | undefined,
          errorMsg: (data.errorMsg || data.ErrorMsg) as string | undefined,
        };
      }
    } catch (error) {
      logger.error('Nice Payments cancellation failed', { error });
      throw error;
    }
  }

  /**
   * Get payment status
   * 
   * @param tid Transaction ID or orderId
   * @returns Payment status
   */
  async getPaymentStatus(tid: string): Promise<NicePayPaymentResponse> {
    try {
      // In test mode, return mock status
      if (this.isTestMode) {
        return {
          success: true,
          resultCode: '0000',
          tid,
          orderId: tid,
        };
      }

      // Real Nice Payments status API call
      const response = await fetch(`${this.baseUrl}/v1/payments/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Nice Payments status API error: ${response.status}`);
      }

      const data = await response.json() as Record<string, unknown>;
      return {
        success: (data.resultCode || data.ResultCode) === '0000',
        resultCode: (data.resultCode || data.ResultCode) as string | undefined,
        resultMsg: (data.resultMsg || data.ResultMsg) as string | undefined,
        tid: (data.tid || data.TID) as string | undefined,
        orderId: (data.orderId || data.OrderID) as string | undefined,
        amount: (data.amount || data.Amount) as number | undefined,
      };
    } catch (error) {
      logger.error('Nice Payments status check failed', { error });
      throw error;
    }
  }

  /**
   * Simulate test payment (for development)
   */
  private simulateTestPayment(request: NicePayPaymentRequest): NicePayPaymentResponse {
    // Simulate API delay
    const testTid = `TEST_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    logger.info('Simulating test payment', { orderId: request.orderId, tid: testTid });

    return {
      success: true,
      resultCode: '0000',
      resultMsg: '테스트 결제 성공',
      tid: testTid,
      orderId: request.orderId,
      amount: request.amount,
      payMethod: 'CARD',
      authDate: new Date().toISOString(),
      cardCode: 'TEST',
      cardName: '테스트카드',
      cardNo: '****-****-****-1234',
    };
  }
}

export const nicePayProvider = new NicePayProvider();
