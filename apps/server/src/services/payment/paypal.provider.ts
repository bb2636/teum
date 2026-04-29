import { logger } from '../../config/logger';

const PAYPAL_BASE_URL = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

let cachedProductId: string | null = null;
let cachedPlanId: string | null = null;

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

  async ensureProductAndPlan(amount: string, currency: string): Promise<{ productId: string; planId: string }> {
    const token = await this.getAccessToken();

    if (cachedProductId && cachedPlanId) {
      return { productId: cachedProductId, planId: cachedPlanId };
    }

    const listPlansRes = await fetch(`${PAYPAL_BASE_URL}/v1/billing/plans?page_size=20&page=1&total_required=true`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (listPlansRes.ok) {
      const plansData = await listPlansRes.json() as { plans?: Array<{ id: string; status: string; name: string; billing_cycles: Array<{ pricing_scheme: { fixed_price: { value: string; currency_code: string } } }> }> };
      const existingPlan = plansData.plans?.find(
        (p) => {
          if (p.status !== 'ACTIVE' || p.name !== 'Teum Music Plan Monthly') return false;
          const cycle = p.billing_cycles?.[0];
          if (cycle) {
            const price = cycle.pricing_scheme?.fixed_price;
            if (price && (price.value !== amount || price.currency_code !== currency)) {
              logger.info({ planId: p.id, planPrice: price.value, planCurrency: price.currency_code, expectedAmount: amount, expectedCurrency: currency }, 'Skipping plan with mismatched pricing');
              return false;
            }
          }
          return true;
        }
      );
      if (existingPlan) {
        cachedPlanId = existingPlan.id;
        const listProductsRes = await fetch(`${PAYPAL_BASE_URL}/v1/catalogs/products?page_size=20&page=1&total_required=true`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        if (listProductsRes.ok) {
          const productsData = await listProductsRes.json() as { products?: Array<{ id: string; name: string }> };
          const existingProduct = productsData.products?.find((p) => p.name === 'Teum Premium');
          if (existingProduct) {
            cachedProductId = existingProduct.id;
            logger.info({ productId: cachedProductId, planId: cachedPlanId }, 'Using existing PayPal product and plan');
            return { productId: cachedProductId, planId: cachedPlanId };
          }
        }
      }
    }

    let productId = cachedProductId;
    if (!productId) {
      const productRes = await fetch(`${PAYPAL_BASE_URL}/v1/catalogs/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: 'Teum Premium',
          description: 'Teum Music Plan - Monthly Subscription',
          type: 'SERVICE',
          category: 'SOFTWARE',
        }),
      });

      if (!productRes.ok) {
        const text = await productRes.text();
        logger.error({ status: productRes.status, body: text }, 'PayPal create product failed');
        throw new Error('Failed to create PayPal product');
      }

      const productData = await productRes.json() as { id: string };
      productId = productData.id;
      cachedProductId = productId;
      logger.info({ productId }, 'PayPal product created');
    }

    const planRes = await fetch(`${PAYPAL_BASE_URL}/v1/billing/plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        product_id: productId,
        name: 'Teum Music Plan Monthly',
        description: 'Monthly subscription for Teum Music Plan',
        billing_cycles: [
          {
            frequency: {
              interval_unit: 'MONTH',
              interval_count: 1,
            },
            tenure_type: 'REGULAR',
            sequence: 1,
            total_cycles: 0,
            pricing_scheme: {
              fixed_price: {
                value: amount,
                currency_code: currency,
              },
            },
          },
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          payment_failure_threshold: 3,
        },
      }),
    });

    if (!planRes.ok) {
      const text = await planRes.text();
      logger.error({ status: planRes.status, body: text }, 'PayPal create plan failed');
      throw new Error('Failed to create PayPal plan');
    }

    const planData = await planRes.json() as { id: string };
    cachedPlanId = planData.id;
    logger.info({ planId: cachedPlanId, productId }, 'PayPal plan created');

    return { productId: productId!, planId: cachedPlanId };
  }

  async createSubscription(
    planId: string,
    returnUrl: string,
    cancelUrl: string,
    customId: string,
  ): Promise<{ subscriptionId: string; approveUrl: string }> {
    const token = await this.getAccessToken();

    const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        plan_id: planId,
        custom_id: customId,
        application_context: {
          brand_name: 'TEUM',
          // BILLING: 게스트 친화적 결제 페이지를 우선 노출 (가입 강제 마찰 감소).
          landing_page: 'BILLING',
          // 디지털 구독: 배송지 입력 화면 비활성화 (필수).
          shipping_preference: 'NO_SHIPPING',
          // CTA 버튼을 "Continue" → "Subscribe"로 변경하여 전환율 개선.
          user_action: 'SUBSCRIBE_NOW',
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '(unreadable)');
      logger.error({ status: response.status, body: text }, 'PayPal create subscription failed');
      throw new Error('Failed to create PayPal subscription');
    }

    const data = await response.json() as { id: string; links: Array<{ rel: string; href: string }> };

    const approveLink = data.links?.find((l: { rel: string }) => l.rel === 'approve');
    if (!approveLink) {
      throw new Error('No approval URL in PayPal subscription response');
    }

    logger.info({ paypalSubscriptionId: data.id, customId }, 'PayPal subscription created (pending approval)');

    return {
      subscriptionId: data.id,
      approveUrl: approveLink.href,
    };
  }

  async getSubscriptionDetails(subscriptionId: string): Promise<{
    status: string;
    planId: string;
    startTime: string;
    nextBillingTime?: string;
    subscriberEmail?: string;
    customId?: string;
  }> {
    const token = await this.getAccessToken();

    const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error({ status: response.status, body: text, subscriptionId }, 'PayPal get subscription details failed');
      throw new Error('Failed to get PayPal subscription details');
    }

    const data = await response.json() as Record<string, unknown>;
    const subscriber = data.subscriber as Record<string, unknown> | undefined;
    const billingInfo = data.billing_info as Record<string, unknown> | undefined;

    return {
      status: data.status as string,
      planId: data.plan_id as string,
      startTime: data.start_time as string,
      nextBillingTime: (billingInfo?.next_billing_time as string) || undefined,
      subscriberEmail: (subscriber?.email_address as string) || undefined,
      customId: data.custom_id as string | undefined,
    };
  }

  async cancelSubscription(subscriptionId: string, reason: string = 'User requested cancellation'): Promise<boolean> {
    const token = await this.getAccessToken();

    const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason }),
    });

    if (!response.ok && response.status !== 204) {
      const text = await response.text();
      logger.error({ status: response.status, body: text, subscriptionId }, 'PayPal cancel subscription failed');
      return false;
    }

    logger.info({ subscriptionId }, 'PayPal subscription cancelled');
    return true;
  }

  async verifyWebhookSignature(
    headers: Record<string, string | string[] | undefined>,
    body: string,
    webhookId: string
  ): Promise<boolean> {
    try {
      const token = await this.getAccessToken();

      const response = await fetch(`${PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          auth_algo: headers['paypal-auth-algo'] as string,
          cert_url: headers['paypal-cert-url'] as string,
          transmission_id: headers['paypal-transmission-id'] as string,
          transmission_sig: headers['paypal-transmission-sig'] as string,
          transmission_time: headers['paypal-transmission-time'] as string,
          webhook_id: webhookId,
          webhook_event: JSON.parse(body),
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        logger.error({ status: response.status, body: text }, 'PayPal webhook signature verification request failed');
        return false;
      }

      const data = await response.json() as { verification_status: string };
      return data.verification_status === 'SUCCESS';
    } catch (error) {
      logger.error({ error }, 'PayPal webhook signature verification error');
      return false;
    }
  }

  getClientId(): string {
    return this.clientId;
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }
}

export const paypalProvider = new PayPalProvider();
