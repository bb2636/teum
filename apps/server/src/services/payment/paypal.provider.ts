import { logger } from '../../config/logger';

const PAYPAL_BASE_URL = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

export class PayPalProvider {
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.clientId = process.env.PAYPAL_CLIENT_ID || '';
    this.clientSecret = process.env.PAYPAL_CLIENT_SECRET || '';
    if (this.clientId && this.clientSecret) {
      logger.info('PayPal provider initialized');
    } else {
      logger.warn('PayPal provider: missing credentials');
    }
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${auth}`,
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error({ status: response.status, body: text }, 'PayPal token request failed');
      throw new Error('Failed to get PayPal access token');
    }

    const data = await response.json() as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return this.accessToken;
  }

  async createOrder(amount: string, currency: string, orderId: string, planName: string, returnUrl: string, cancelUrl: string): Promise<{ id: string; approveUrl: string }> {
    const token = await this.getAccessToken();

    const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: orderId,
          description: planName,
          amount: {
            currency_code: currency,
            value: amount,
          },
        }],
        application_context: {
          brand_name: 'Teum',
          landing_page: 'LOGIN',
          user_action: 'PAY_NOW',
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
      }),
    });

    const data = await response.json() as { id: string; links: Array<{ rel: string; href: string }> };

    if (!response.ok) {
      logger.error({ status: response.status, data }, 'PayPal create order failed');
      throw new Error('Failed to create PayPal order');
    }

    const approveLink = data.links?.find((l: { rel: string }) => l.rel === 'approve');
    if (!approveLink) {
      throw new Error('No approval URL in PayPal response');
    }

    logger.info({ paypalOrderId: data.id, orderId }, 'PayPal order created');

    return {
      id: data.id,
      approveUrl: approveLink.href,
    };
  }

  async captureOrder(paypalOrderId: string): Promise<{
    success: boolean;
    transactionId?: string;
    payerEmail?: string;
    amount?: string;
    currency?: string;
    errorMsg?: string;
  }> {
    const token = await this.getAccessToken();

    const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${paypalOrderId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      logger.error({ status: response.status, data }, 'PayPal capture failed');
      return { success: false, errorMsg: 'PayPal capture failed' };
    }

    const status = data.status as string;
    if (status !== 'COMPLETED') {
      logger.error({ status, data }, 'PayPal order not completed');
      return { success: false, errorMsg: `PayPal order status: ${status}` };
    }

    const purchaseUnits = data.purchase_units as Array<Record<string, unknown>>;
    const captures = (purchaseUnits?.[0]?.payments as Record<string, unknown>)?.captures as Array<Record<string, unknown>>;
    const capture = captures?.[0];
    const captureAmount = capture?.amount as Record<string, unknown>;
    const payer = data.payer as Record<string, unknown>;

    logger.info({
      paypalOrderId,
      captureId: capture?.id,
      status,
    }, 'PayPal order captured');

    return {
      success: true,
      transactionId: capture?.id as string,
      payerEmail: payer?.email_address as string,
      amount: captureAmount?.value as string,
      currency: captureAmount?.currency_code as string,
    };
  }

  getClientId(): string {
    return this.clientId;
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }
}

export const paypalProvider = new PayPalProvider();
