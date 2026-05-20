import { logger } from '../../config/logger';
import { AppError } from '../../middleware/error-handler';

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
      throw new AppError('PayPal 인증에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요.', {
        statusCode: 502,
        code: 'PAYPAL_AUTH_FAILED',
      });
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
        throw new AppError('PayPal 상품 등록에 실패했습니다. 잠시 후 다시 시도해주세요.', {
          statusCode: 502,
          code: 'PAYPAL_PRODUCT_FAILED',
        });
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
      throw new AppError('PayPal 결제 플랜 생성에 실패했습니다. 잠시 후 다시 시도해주세요.', {
        statusCode: 502,
        code: 'PAYPAL_PLAN_FAILED',
      });
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
      throw new AppError('PayPal 구독 생성에 실패했습니다. 잠시 후 다시 시도해주세요.', {
        statusCode: 502,
        code: 'PAYPAL_SUBSCRIPTION_FAILED',
      });
    }

    const data = await response.json() as { id: string; links: Array<{ rel: string; href: string }> };

    const approveLink = data.links?.find((l: { rel: string }) => l.rel === 'approve');
    if (!approveLink) {
      throw new AppError('PayPal 결제 페이지 URL을 받지 못했습니다.', {
        statusCode: 502,
        code: 'PAYPAL_APPROVAL_URL_MISSING',
      });
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
      throw new AppError('PayPal 구독 정보 조회에 실패했습니다.', {
        statusCode: 502,
        code: 'PAYPAL_DETAILS_FAILED',
      });
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

    if (response.ok || response.status === 204) {
      logger.info({ subscriptionId }, 'PayPal subscription cancelled');
      return true;
    }

    // Idempotency: 이미 CANCELLED/EXPIRED 등 terminal 상태이면 PayPal 은 422 + SUBSCRIPTION_STATUS_INVALID
    // 류 응답을 준다. 보상 cancel 입장에서는 이미 종결된 상태도 "성공"으로 봐야 안전하다.
    const text = await response.text();
    if (response.status === 422) {
      try {
        const details = await this.getSubscriptionDetails(subscriptionId);
        if (
          details.status === 'CANCELLED' ||
          details.status === 'EXPIRED' ||
          details.status === 'SUSPENDED'
        ) {
          logger.info(
            { subscriptionId, paypalStatus: details.status },
            'PayPal subscription already in terminal state, treating cancel as idempotent success',
          );
          return true;
        }
      } catch (verifyErr) {
        logger.warn(
          { subscriptionId, error: verifyErr instanceof Error ? verifyErr.message : String(verifyErr) },
          'PayPal cancel 422 + status verification failed',
        );
      }
    }

    logger.error({ status: response.status, body: text, subscriptionId }, 'PayPal cancel subscription failed');
    return false;
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

  /**
   * PayPal Orders v2 — 일회성 결제(자동 갱신 없음).
   * 인도 RBI e-mandate 규제 등으로 정기 구독이 불가한 사용자에게 사용한다.
   */
  async createOneTimeOrder(
    amount: string,
    currency: string,
    returnUrl: string,
    cancelUrl: string,
    customId: string,
    description: string = 'Teum Music Plan - 1 Month',
  ): Promise<{ orderId: string; approveUrl: string }> {
    const token = await this.getAccessToken();
    const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'PayPal-Request-Id': customId,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: customId,
            custom_id: customId,
            description,
            amount: {
              currency_code: currency,
              value: amount,
            },
          },
        ],
        application_context: {
          brand_name: 'TEUM',
          landing_page: 'BILLING',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '(unreadable)');
      logger.error({ status: response.status, body: text }, 'PayPal create one-time order failed');
      throw new AppError('PayPal 주문 생성에 실패했습니다. 잠시 후 다시 시도해주세요.', {
        statusCode: 502,
        code: 'PAYPAL_ORDER_FAILED',
      });
    }

    const data = (await response.json()) as { id: string; links: Array<{ rel: string; href: string }> };
    const approveLink = data.links?.find((l) => l.rel === 'approve' || l.rel === 'payer-action');
    if (!approveLink) {
      throw new AppError('PayPal 주문 결제 페이지 URL을 받지 못했습니다.', {
        statusCode: 502,
        code: 'PAYPAL_ORDER_APPROVAL_URL_MISSING',
      });
    }

    logger.info({ paypalOrderId: data.id, customId }, 'PayPal one-time order created');
    return { orderId: data.id, approveUrl: approveLink.href };
  }

  /**
   * 사용자가 PayPal 결제 페이지에서 승인한 주문을 실제로 캡쳐(과금)한다.
   * 인도 카드 등 카드사가 거절하면 여기서 실패가 떨어진다.
   */
  async captureOrder(orderId: string): Promise<{
    status: string;
    captureId?: string;
    customId?: string;
    payerEmail?: string;
    amountValue?: string;
    amountCurrency?: string;
  }> {
    const token = await this.getAccessToken();
    const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      logger.error(
        { status: response.status, body: data, orderId },
        'PayPal capture order failed',
      );
      const status = (data.name as string) || 'CAPTURE_FAILED';
      return { status };
    }

    const purchaseUnits = (data.purchase_units as Array<Record<string, unknown>>) || [];
    const firstUnit = purchaseUnits[0] || {};
    const payments = (firstUnit.payments as Record<string, unknown>) || {};
    const captures = (payments.captures as Array<Record<string, unknown>>) || [];
    const capture = captures[0];
    const amount = capture?.amount as Record<string, unknown> | undefined;
    const payer = data.payer as Record<string, unknown> | undefined;

    return {
      status: (data.status as string) || 'UNKNOWN',
      captureId: (capture?.id as string) || undefined,
      customId: (firstUnit.custom_id as string) || (firstUnit.reference_id as string) || undefined,
      payerEmail: (payer?.email_address as string) || undefined,
      amountValue: (amount?.value as string) || undefined,
      amountCurrency: (amount?.currency_code as string) || undefined,
    };
  }

  /**
   * 일회성(Orders v2) 캡쳐를 환불한다. 보상 트랜잭션용.
   * (정기 구독은 별도 sale refund API 사용 — 여기는 capture 환불 전용)
   */
  async refundCapture(captureId: string, reason?: string): Promise<{ ok: boolean; refundId?: string }> {
    try {
      const token = await this.getAccessToken();
      const res = await fetch(`${PAYPAL_BASE_URL}/v2/payments/captures/${captureId}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'PayPal-Request-Id': `refund_${captureId}`,
        },
        body: JSON.stringify(reason ? { note_to_payer: reason } : {}),
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        logger.error({ status: res.status, body, captureId }, 'PayPal refund capture failed');
        return { ok: false };
      }
      return { ok: true, refundId: body.id as string | undefined };
    } catch (err) {
      logger.error({ err, captureId }, 'PayPal refund capture exception');
      return { ok: false };
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
