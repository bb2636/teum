import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { paymentService } from '../services/payment.service';
import { processPaymentSchema, initPaymentSchema, initBillingKeySchema, cancelPaymentSchema, cancelSubscriptionSchema, adminCancelSubscriptionSchema } from '../validations/payment';
import { logger } from '../config/logger';
import { getExchangeInfo } from '../utils/currency';
import { refundService } from '../services/payment/refund.service';
import { paypalProvider } from '../services/payment/paypal.provider';
import { nicePayProvider } from '../services/payment/nicepay.provider';
import { appleProvider } from '../services/payment/apple.provider';
import { z } from 'zod';

const NICEPAY_LAUNCH_TTL_MS = 30 * 60 * 1000;

function getLaunchSigningKey(): string {
  const key = process.env.JWT_SECRET;
  if (!key) {
    throw new Error('JWT_SECRET is required for NicePay launch token signing');
  }
  return key;
}

function signLaunchToken(orderId: string, expiresAt: number): string {
  const payload = `${orderId}.${expiresAt}`;
  const sig = crypto
    .createHmac('sha256', getLaunchSigningKey())
    .update(payload)
    .digest('base64url');
  return `${expiresAt}.${sig}`;
}

function verifyLaunchToken(orderId: unknown, token: unknown): boolean {
  if (typeof orderId !== 'string' || !orderId) return false;
  if (typeof token !== 'string' || !token) return false;
  const [expStr, sig] = token.split('.');
  if (!expStr || !sig) return false;
  const expiresAt = Number(expStr);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const expected = signLaunchToken(orderId, expiresAt).split('.')[1];
  if (!expected || expected.length !== sig.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

function getStringQuery(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderNativeReturnHtml(deepLink: string, isSuccess: boolean, message?: string): string {
  const title = isSuccess ? '결제 완료' : '결제 실패';
  const headline = isSuccess ? '결제가 완료되었습니다' : '결제 처리에 실패했습니다';
  const subtitle = isSuccess
    ? '잠시 후 앱으로 자동 이동합니다.'
    : (message ? message : '잠시 후 앱으로 자동 이동합니다.');
  const iconColor = isSuccess ? '#34c759' : '#ff3b30';
  const iconChar = isSuccess ? '✓' : '!';
  const safeHref = htmlEscape(deepLink);
  const safeTitle = htmlEscape(title);
  const safeHeadline = htmlEscape(headline);
  const safeSubtitle = htmlEscape(subtitle);
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeTitle}</title>
<style>
  html,body{margin:0;padding:0;background:#f5f5f7;color:#1d1d1f;-webkit-font-smoothing:antialiased;}
  body{min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Helvetica Neue',sans-serif;}
  .card{max-width:420px;margin:24px;padding:32px 24px;background:#fff;border-radius:16px;box-shadow:0 8px 24px rgba(0,0,0,0.06);text-align:center;}
  .icon{width:64px;height:64px;margin:0 auto 16px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:32px;color:#fff;background:${iconColor};font-weight:700;}
  h1{font-size:20px;margin:0 0 8px;font-weight:600;}
  p{font-size:15px;color:#6e6e73;margin:0 0 24px;line-height:1.5;}
  a.btn{display:inline-block;padding:14px 32px;background:#007aff;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:16px;}
  a.btn:active{background:#0062cc;}
  small{display:block;margin-top:16px;color:#86868b;font-size:13px;line-height:1.5;}
</style>
</head>
<body>
  <div class="card">
    <div class="icon">${iconChar}</div>
    <h1>${safeHeadline}</h1>
    <p>${safeSubtitle}</p>
    <a class="btn" href="${safeHref}" id="returnBtn">앱으로 돌아가기</a>
    <small>이 화면이 자동으로 닫히지 않으면<br>좌측 상단의 ✕ 또는 위 버튼을 눌러주세요.</small>
  </div>
  <script>
  (function(){
    var url = ${JSON.stringify(deepLink)};
    function go(){ try { window.location.href = url; } catch(e) {} }
    go();
    setTimeout(go, 300);
    setTimeout(function(){
      try { var b = document.getElementById('returnBtn'); if (b && b.click) b.click(); } catch(e) {}
    }, 600);
  })();
  </script>
</body>
</html>`;
}

function sendPaymentReturn(
  res: Response,
  isNative: boolean,
  isSuccess: boolean,
  frontendUrl: string,
  message?: string
) {
  if (isNative) {
    const deepLink = isSuccess
      ? 'com.teum.app://payment-result?status=success'
      : `com.teum.app://payment-result?status=fail&message=${encodeURIComponent(message || '')}`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(renderNativeReturnHtml(deepLink, isSuccess, message));
  }
  const url = isSuccess
    ? `${frontendUrl}/payment/success`
    : `${frontendUrl}/payment/fail?message=${encodeURIComponent(message || '')}`;
  return res.redirect(url);
}

const appleVerifyReceiptSchema = z.object({
  transactionId: z.string().min(1).optional(),
  receipt: z.string().min(1).optional(),
}).refine((d) => !!d.transactionId || !!d.receipt, {
  message: 'transactionId 또는 receipt가 필요합니다.',
});

const applePrecheckSchema = z.object({
  productId: z.string().min(1),
});

const appleWebhookSchema = z.object({
  signedPayload: z.string().min(1),
});

export class PaymentController {
  async getPlanPrice(req: Request, res: Response, next: NextFunction) {
    try {
      const exchangeInfo = await getExchangeInfo();
      res.json({
        success: true,
        data: {
          usd: exchangeInfo.usd,
          krw: exchangeInfo.krw,
          rate: exchangeInfo.rate,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async initPayment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const input = initPaymentSchema.parse(req.body);

      const backendUrl = process.env.BACKEND_URL || process.env.FRONTEND_URL || `https://${process.env.REPLIT_DEV_DOMAIN || 'localhost:5000'}`;
      const returnUrl = `${backendUrl}/api/payments/nicepay/return`;

      const result = await paymentService.initPayment(req.user.userId, {
        planName: input.planName,
        paymentMethod: input.paymentMethod,
      });

      res.json({
        success: true,
        data: {
          ...result,
          returnUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async initBillingKey(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const input = initBillingKeySchema.parse(req.body);

      const backendUrl = process.env.BACKEND_URL || process.env.FRONTEND_URL || `https://${process.env.REPLIT_DEV_DOMAIN || 'localhost:5000'}`;
      const returnUrl = `${backendUrl}/api/payments/nicepay/billing-return`;

      const result = await paymentService.initBillingKeyRegistration(req.user.userId, {
        planName: input.planName,
        paymentMethod: input.paymentMethod,
        identityVerified: input.identityVerified,
      });

      const launchExpiresAt = Date.now() + NICEPAY_LAUNCH_TTL_MS;
      const launchToken = signLaunchToken(result.orderId, launchExpiresAt);
      const launchUrl = `${backendUrl}/api/payments/nicepay/launch?orderId=${encodeURIComponent(result.orderId)}&native=1&token=${encodeURIComponent(launchToken)}`;

      res.json({
        success: true,
        data: {
          ...result,
          returnUrl,
          launchUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async nicepayLaunch(req: Request, res: Response) {
    const orderId = getStringQuery(req.query.orderId);
    const cardCode = getStringQuery(req.query.cardCode);
    const token = getStringQuery(req.query.token);
    const isNative = getStringQuery(req.query.native) === '1';

    const errorPage = (msg: string, status = 400) => {
      const safe = String(msg).replace(/[<>&"']/g, (c) => ({
        '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;',
      }[c] as string));
      return res.status(status).type('text/html; charset=utf-8').send(
        `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>결제 오류</title></head><body style="margin:0;padding:32px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;text-align:center;color:#333;"><p>${safe}</p></body></html>`
      );
    };

    if (!orderId) {
      return errorPage('주문 정보가 누락되었습니다.');
    }

    if (!verifyLaunchToken(orderId, token)) {
      logger.warn({ orderId, ip: req.ip }, 'NicePay launch: invalid or expired token');
      return errorPage('유효하지 않거나 만료된 결제 링크입니다.', 403);
    }

    try {
      const session = await paymentService.getPendingSession(orderId);
      if (!session) {
        return errorPage('결제 세션을 찾을 수 없거나 만료되었습니다.', 404);
      }

      const clientId = nicePayProvider.getClientId();
      if (!clientId) {
        logger.error('NicePay launch: clientId not configured');
        return errorPage('결제 설정이 올바르지 않습니다.', 500);
      }

      const amount = Math.round(Number(session.amount) || 0);
      const goodsName = session.planName || '구독';
      const backendUrl = process.env.BACKEND_URL || process.env.FRONTEND_URL || `https://${process.env.REPLIT_DEV_DOMAIN || 'localhost:5000'}`;
      const returnUrl = `${backendUrl}/api/payments/nicepay/billing-return${isNative ? '?native=1' : ''}`;

      const jsEsc = (s: string) => String(s).replace(/[\\'"<>&\r\n\u2028\u2029]/g, (c) => {
        const map: Record<string, string> = {
          '\\': '\\\\', "'": "\\'", '"': '\\"',
          '<': '\\u003c', '>': '\\u003e', '&': '\\u0026',
          '\r': '\\r', '\n': '\\n', '\u2028': '\\u2028', '\u2029': '\\u2029',
        };
        return map[c];
      });

      const cardCodeLine = cardCode
        ? `\n          cardCode: '${jsEsc(cardCode)}',`
        : '';

      const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>결제 진행</title>
<script src="https://pay.nicepay.co.kr/v1/js/"></script>
<style>
  body { margin: 0; padding: 32px 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; text-align: center; color: #333; background: #fff; }
  .spinner { width: 32px; height: 32px; border: 3px solid #eee; border-top-color: #4A2C1A; border-radius: 50%; animation: spin 0.9s linear infinite; margin: 0 auto 16px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  #status { margin: 0; font-size: 14px; line-height: 1.5; color: #666; }
</style>
</head>
<body>
<div class="spinner" id="spinner"></div>
<p id="status">결제창으로 이동 중입니다...</p>
<script>
(function () {
  var statusEl = document.getElementById('status');
  var spinnerEl = document.getElementById('spinner');
  function showError(msg) {
    if (spinnerEl) spinnerEl.style.display = 'none';
    statusEl.style.color = '#c00';
    statusEl.textContent = '결제 실패: ' + (msg || '알 수 없는 오류');
  }
  function start() {
    if (typeof AUTHNICE === 'undefined' || !AUTHNICE.requestPay) {
      showError('결제 모듈을 불러오지 못했습니다.');
      return;
    }
    try {
      AUTHNICE.requestPay({
        clientId: '${jsEsc(clientId)}',
        method: 'card',
        orderId: '${jsEsc(orderId)}',
        amount: ${amount},
        goodsName: '${jsEsc(goodsName)}',
        returnUrl: '${jsEsc(returnUrl)}',
        subscYn: 'Y',${cardCodeLine}
        fnError: function (result) {
          showError((result && (result.errorMsg || result.resultMsg)) || '');
        }
      });
    } catch (e) {
      showError(e && e.message ? e.message : String(e));
    }
  }
  if (document.readyState === 'complete') {
    start();
  } else {
    window.addEventListener('load', start);
  }
})();
</script>
</body>
</html>`;

      res.type('text/html; charset=utf-8').send(html);
    } catch (error) {
      logger.error('NicePay launch handler error', { error, orderId });
      return errorPage('결제 페이지를 불러오지 못했습니다.', 500);
    }
  }

  async nicepayBillingReturn(req: Request, res: Response) {
    const frontendUrl = process.env.FRONTEND_URL || `https://${process.env.REPLIT_DEV_DOMAIN || 'localhost:5000'}`;
    try {
      const body = req.body;
      const bodyKeys = Object.keys(body);
      logger.info({
        bodyKeys: bodyKeys.join(', '),
        hasAuthToken: !!body.authToken,
        hasEncData: !!body.encData,
        hasBid: !!body.bid,
        hasTid: !!body.tid,
        authResultCode: body.authResultCode,
        authResultMsg: body.authResultMsg,
        orderId: body.orderId,
        amount: body.amount,
      }, 'NicePay billing return received');

      const resultCode = body.authResultCode || body.resultCode;
      const resultMsg = body.authResultMsg || body.resultMsg;
      const { orderId, amount, tid } = body;
      const authToken = body.authToken || body.encData;
      let bid = body.bid;

      const isNative = req.query.native === '1';
      const sendSuccess = () => sendPaymentReturn(res, isNative, true, frontendUrl);
      const sendFail = (msg: string) => sendPaymentReturn(res, isNative, false, frontendUrl, msg);

      logger.info({
        resultCode,
        resultMsg,
        hasBid: !!bid,
        hasTid: !!tid,
        hasAuthToken: !!authToken,
        orderId,
        amount,
        isNative,
      }, 'NicePay billing return parsed');

      if (!orderId) {
        logger.error('NicePay billing return missing orderId');
        return sendFail('주문 정보가 누락되었습니다.');
      }

      const preloadedSession = await paymentService.getPendingSession(orderId);
      if (!preloadedSession) {
        logger.info({ orderId }, 'NicePay billing return: session not found (likely page refresh after success)');
        return sendSuccess();
      }

      logger.info({ orderId, sessionUserId: preloadedSession.userId, sessionAmount: preloadedSession.amount }, 'Session preloaded for billing return');

      if (resultCode !== '0000') {
        await paymentService.deletePendingSession(orderId);
        logger.error(`NicePay billing auth failed - code=${resultCode} msg=${resultMsg}`);
        return sendFail(resultMsg || '빌링키 등록에 실패했습니다.');
      }

      if (!bid && authToken && tid) {
        const numericAmount = Number(amount) || 0;
        const issueResult = await paymentService.issueBillingKey(authToken, tid, orderId, numericAmount);
        if (issueResult.success && issueResult.bid) {
          bid = issueResult.bid;
        } else if (issueResult.success && issueResult.paidWithoutBid) {
          logger.info({ orderId, tid: issueResult.tid }, 'Payment approved without bid - processing as direct payment');
          const directResult = await paymentService.processDirectPaymentReturn(
            orderId,
            issueResult.tid || tid,
            issueResult.cardCode,
            issueResult.cardName,
            issueResult.cardNo,
            { userId: preloadedSession.userId, amount: preloadedSession.amount, planName: preloadedSession.planName }
          );
          if (directResult.success) {
            return sendSuccess();
          } else {
            return sendFail(directResult.message);
          }
        } else {
          await paymentService.deletePendingSession(orderId);
          logger.error({ orderId, errorMsg: issueResult.message }, 'NicePay billing key issue failed');
          return sendFail(issueResult.message || '빌링키 발급에 실패했습니다.');
        }
      }

      if (!bid) {
        await paymentService.deletePendingSession(orderId);
        logger.error('NicePay billing return missing bid and authToken', { orderId });
        return sendFail('빌링키 정보가 누락되었습니다.');
      }

      const result = await paymentService.processBillingKeyReturn(
        bid,
        orderId
      );

      if (result.success) {
        return sendSuccess();
      } else {
        return sendFail(result.message);
      }
    } catch (error) {
      logger.error('NicePay billing return handler error', { error });
      const isNative = req.query.native === '1';
      return sendPaymentReturn(res, isNative, false, frontendUrl, '빌링키 등록 처리 중 오류가 발생했습니다.');
    }
  }

  async nicepayReturn(req: Request, res: Response) {
    const frontendUrl = process.env.FRONTEND_URL || `https://${process.env.REPLIT_DEV_DOMAIN || 'localhost:5000'}`;
    try {
      const body = req.body;
      logger.info({ bodyKeys: Object.keys(body).join(', ') }, 'NicePay return received');
      const resultCode = body.authResultCode || body.resultCode;
      const resultMsg = body.authResultMsg || body.resultMsg;
      const { tid, orderId, amount, authToken } = body;

      logger.info(`NicePay return - code=${resultCode} msg=${resultMsg} tid=${tid} orderId=${orderId} amount=${amount}`);

      if (!orderId) {
        logger.error('NicePay return missing orderId');
        return res.redirect(`${frontendUrl}/payment/fail?message=${encodeURIComponent('주문 정보가 누락되었습니다.')}`);
      }

      if (resultCode !== '0000') {
        await paymentService.deletePendingSession(orderId);
        logger.error(`NicePay auth failed - code=${resultCode} msg=${resultMsg} orderId=${orderId}`);
        return res.redirect(`${frontendUrl}/payment/fail?message=${encodeURIComponent(resultMsg || '결제 인증에 실패했습니다.')}`);
      }

      if (!tid) {
        await paymentService.deletePendingSession(orderId);
        logger.error('NicePay return missing tid', { orderId });
        return res.redirect(`${frontendUrl}/payment/fail?message=${encodeURIComponent('결제 거래 정보가 누락되었습니다.')}`);
      }

      const parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        await paymentService.deletePendingSession(orderId);
        logger.error('NicePay return invalid amount', { orderId, amount });
        return res.redirect(`${frontendUrl}/payment/fail?message=${encodeURIComponent('결제 금액 정보가 올바르지 않습니다.')}`);
      }

      const result = await paymentService.approveNicePayPayment(
        tid,
        orderId,
        parsedAmount
      );

      if (result.success) {
        return res.redirect(`${frontendUrl}/payment/success`);
      } else {
        return res.redirect(`${frontendUrl}/payment/fail?message=${encodeURIComponent(result.message)}`);
      }
    } catch (error) {
      logger.error('NicePay return handler error', { error });
      return res.redirect(`${frontendUrl}/payment/fail?message=${encodeURIComponent('결제 처리 중 오류가 발생했습니다.')}`);
    }
  }

  async processPayment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const input = processPaymentSchema.parse(req.body);
      const result = await paymentService.processPayment(req.user.userId, input);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPayments(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const payments = await paymentService.getPayments(req.user.userId);
      res.json({
        success: true,
        data: { payments },
      });
    } catch (error) {
      next(error);
    }
  }

  async getSubscriptions(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const subscriptions = await paymentService.getSubscriptions(req.user.userId);
      res.json({
        success: true,
        data: { subscriptions },
      });
    } catch (error) {
      next(error);
    }
  }

  async needsVerification(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const needsVerification = await paymentService.needsIdentityVerification(req.user.userId);
      res.json({
        success: true,
        data: { needsVerification },
      });
    } catch (error) {
      next(error);
    }
  }

  async cancelPayment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const input = cancelPaymentSchema.parse(req.body);

      const result = await paymentService.cancelPayment(req.user.userId, input.tid, input.amount, input.reason);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async cancelSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const input = cancelSubscriptionSchema.parse(req.body);

      const result = await paymentService.cancelSubscription(req.user.userId, input.subscriptionId);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getBillingKeyStatus(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }
      const result = await paymentService.getBillingKeyStatusForUser(req.user.userId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async restoreBilling(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }
      const result = await paymentService.restoreSubscriptionWithBillingKey(req.user.userId);
      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: { code: 'BILLING_RESTORE_FAILED', message: result.message },
        });
      }
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async adminCancelSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const input = adminCancelSubscriptionSchema.parse(req.body);

      const result = await paymentService.cancelSubscription(input.userId, input.subscriptionId);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async initPayPal(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const userId = req.user.userId;
      const planName = 'Music Plan Monthly';
      const isNative = req.body?.isNative === true;

      const backendUrl = process.env.BACKEND_URL || process.env.FRONTEND_URL || `https://${process.env.REPLIT_DEV_DOMAIN || 'localhost:5000'}`;

      const result = await paymentService.initPayPalPayment(
        userId,
        planName,
        backendUrl,
        isNative
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async paypalReturn(req: Request, res: Response, _next: NextFunction) {
    const frontendUrl = process.env.FRONTEND_URL || `https://${process.env.REPLIT_DEV_DOMAIN || 'localhost:5000'}`;
    const isNative = req.query.n === '1';
    const nativeQp = isNative ? '&n=1' : '';
    try {
      const { subscription_id: paypalSubscriptionId, oid: internalOrderId } = req.query;

      if (!paypalSubscriptionId || !internalOrderId) {
        return res.redirect(`${frontendUrl}/payment/fail?message=${encodeURIComponent('PayPal subscription information is missing.')}${nativeQp}`);
      }

      const result = await paymentService.activatePayPalSubscription(
        paypalSubscriptionId as string,
        internalOrderId as string
      );

      if (result.success) {
        return res.redirect(`${frontendUrl}/payment/success${isNative ? '?n=1' : ''}`);
      } else {
        return res.redirect(`${frontendUrl}/payment/fail?message=${encodeURIComponent(result.message)}${nativeQp}`);
      }
    } catch (error) {
      logger.error({ error }, 'PayPal return processing failed');
      return res.redirect(`${frontendUrl}/payment/fail?message=${encodeURIComponent('PayPal subscription processing failed.')}${nativeQp}`);
    }
  }

  async paypalCancel(req: Request, res: Response, _next: NextFunction) {
    const frontendUrl = process.env.FRONTEND_URL || `https://${process.env.REPLIT_DEV_DOMAIN || 'localhost:5000'}`;
    const isNative = req.query.n === '1';
    const nativeQp = isNative ? '&n=1' : '';
    const { token: paypalOrderId, oid: internalOrderId, ba_token } = req.query;
    // 취소 추적용 명시적 allowlist만 기록 (token/oid/ba_token).
    // 민감 정보 누출 방지를 위해 raw query/referer/UA는 로그에 남기지 않는다.
    logger.info(
      {
        paypalOrderId,
        internalOrderId,
        ba_token,
        isNative,
      },
      'PayPal payment cancelled by user',
    );
    return res.redirect(`${frontendUrl}/payment/fail?message=${encodeURIComponent('Payment was cancelled.')}${nativeQp}`);
  }

  async paypalWebhook(req: Request, res: Response) {
    const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID;

    if (!PAYPAL_WEBHOOK_ID) {
      logger.error('PAYPAL_WEBHOOK_ID not configured, rejecting webhook');
      return res.status(503).json({ error: 'Webhook not configured' });
    }

    const rawBody = (req as Request & { rawBody?: string }).rawBody;
    if (!rawBody) {
      logger.error('PayPal webhook: missing raw body');
      return res.status(400).json({ error: 'Missing request body' });
    }

    const verified = await paypalProvider.verifyWebhookSignature(
      req.headers,
      rawBody,
      PAYPAL_WEBHOOK_ID
    );

    if (!verified) {
      logger.warn({ headers: {
        authAlgo: req.headers['paypal-auth-algo'],
        transmissionId: req.headers['paypal-transmission-id'],
      }}, 'PayPal webhook signature verification failed');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    let event: Record<string, unknown>;
    try {
      event = JSON.parse(rawBody);
    } catch {
      logger.error('PayPal webhook: invalid JSON body');
      return res.status(400).json({ error: 'Invalid JSON' });
    }

    const eventType = event.event_type as string;
    const eventId = event.id as string;

    if (!eventId || !eventType) {
      logger.error({ event }, 'PayPal webhook: missing event_type or id');
      return res.status(400).json({ error: 'Missing event_type or id' });
    }

    const REFUND_EVENTS = ['PAYMENT.SALE.REFUNDED', 'PAYMENT.SALE.REVERSED'];
    const DISPUTE_EVENTS = ['CUSTOMER.DISPUTE.CREATED'];
    const CANCEL_EVENTS = ['BILLING.SUBSCRIPTION.CANCELLED', 'BILLING.SUBSCRIPTION.EXPIRED', 'BILLING.SUBSCRIPTION.SUSPENDED'];
    const ACTIVATE_EVENTS = ['BILLING.SUBSCRIPTION.ACTIVATED'];

    if (ACTIVATE_EVENTS.includes(eventType)) {
      if (await refundService.isDuplicateWebhookEvent(eventId)) {
        logger.info({ eventId, eventType }, 'Duplicate PayPal activate webhook, skipping');
        return res.status(200).json({ status: 'duplicate' });
      }

      const resource = event.resource as Record<string, unknown> | undefined;
      const paypalSubscriptionId = resource?.id as string | undefined;

      if (!paypalSubscriptionId) {
        logger.error({ eventId, eventType }, 'PayPal activate webhook: missing subscription id');
        return res.status(200).json({ status: 'acknowledged' });
      }

      try {
        const subDetails = await paypalProvider.getSubscriptionDetails(paypalSubscriptionId);
        const internalOrderId = subDetails.customId;

        if (!internalOrderId) {
          logger.warn({ eventId, paypalSubscriptionId }, 'PayPal activate webhook: missing custom_id, cannot activate');
          return res.status(200).json({ status: 'acknowledged' });
        }

        const recorded = await refundService.recordWebhookEvent(eventId, 'paypal', eventType, rawBody);
        if (!recorded) {
          logger.info({ eventId, eventType }, 'PayPal activate webhook: concurrent duplicate, skipping');
          return res.status(200).json({ status: 'duplicate' });
        }

        const result = await paymentService.activatePayPalSubscription(paypalSubscriptionId, internalOrderId);
        logger.info({ eventId, paypalSubscriptionId, internalOrderId, result }, 'PayPal subscription activate webhook handled');
      } catch (err) {
        logger.error({ eventId, paypalSubscriptionId, err }, 'PayPal activate webhook processing error');
      }

      return res.status(200).json({ status: 'processed' });
    }

    if (DISPUTE_EVENTS.includes(eventType)) {
      const resource = event.resource as Record<string, unknown> | undefined;
      const disputeId = (resource?.dispute_id as string) || eventId;
      const reason = resource?.reason as string | undefined;
      const disputedTransactions = resource?.disputed_transactions as Array<{ seller_transaction_id?: string }> | undefined;

      const result = await refundService.processPayPalDispute({
        eventId,
        eventType,
        disputeId,
        reason,
        disputedTransactions,
        rawPayload: rawBody,
      });

      logger.info({
        eventId,
        eventType,
        disputeId,
        result,
      }, 'PayPal dispute webhook handled');

      return res.status(200).json({ status: result.reason });
    }

    if (CANCEL_EVENTS.includes(eventType)) {
      if (await refundService.isDuplicateWebhookEvent(eventId)) {
        logger.info({ eventId, eventType }, 'Duplicate PayPal cancel webhook, skipping');
        return res.status(200).json({ status: 'duplicate' });
      }

      const resource = event.resource as Record<string, unknown> | undefined;
      const paypalSubscriptionId = resource?.id as string | undefined;

      if (!paypalSubscriptionId) {
        logger.error({ eventId, eventType }, 'PayPal subscription webhook: missing subscription id');
        return res.status(400).json({ error: 'Missing subscription id' });
      }

      const recorded = await refundService.recordWebhookEvent(eventId, 'paypal', eventType, rawBody);
      if (!recorded) {
        logger.info({ eventId, eventType }, 'PayPal cancel webhook: concurrent duplicate, skipping');
        return res.status(200).json({ status: 'duplicate' });
      }

      const result = await paymentService.handlePayPalSubscriptionCancelled(paypalSubscriptionId, eventType);

      logger.info({
        eventId,
        eventType,
        paypalSubscriptionId,
        result,
      }, 'PayPal subscription cancellation webhook handled');

      return res.status(200).json({ status: result });
    }

    if (!REFUND_EVENTS.includes(eventType)) {
      logger.info({ eventType, eventId }, 'PayPal webhook: unhandled event, acknowledging');
      return res.status(200).json({ status: 'acknowledged' });
    }

    const resource = event.resource as Record<string, unknown> | undefined;
    if (!resource) {
      logger.error({ eventId, eventType }, 'PayPal webhook: missing resource');
      return res.status(400).json({ error: 'Missing resource' });
    }

    const saleId = (resource.id as string) || '';
    const billingAgreementId = resource.billing_agreement_id as string | undefined;
    const amountObj = resource.amount as Record<string, unknown> | undefined;
    const amount = amountObj?.total as string | undefined;
    const currency = amountObj?.currency as string | undefined;

    const result = await refundService.processPayPalRefund({
      eventId,
      eventType,
      saleId,
      billingAgreementId,
      amount,
      currency,
      rawPayload: rawBody,
    });

    logger.info({
      eventId,
      eventType,
      saleId,
      billingAgreementId,
      processed: result.processed,
      reason: result.reason,
    }, 'PayPal refund webhook handled');

    return res.status(200).json({ status: result.reason });
  }

  async appleVerifyReceipt(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const input = appleVerifyReceiptSchema.parse(req.body);
      const result = await paymentService.verifyAppleTransaction(req.user.userId, input);

      return res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 클라이언트가 Apple StoreKit 결제창을 띄우기 직전에 호출하는 PRE-CHECK.
   * 본인인증 / 활성 구독 / productId 를 서버에서 검증해 결제 자체를 막는다.
   */
  async applePrecheck(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const input = applePrecheckSchema.parse(req.body);
      const result = await paymentService.precheckApplePurchase(req.user.userId, input);

      return res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async appleWebhook(req: Request, res: Response) {
    try {
      if (!appleProvider.isEnabled()) {
        logger.error('Apple webhook received but provider not configured');
        return res.status(503).json({ error: 'Apple provider not configured' });
      }

      const parsed = appleWebhookSchema.safeParse(req.body);
      if (!parsed.success) {
        logger.error({ issues: parsed.error.issues }, 'Apple webhook: invalid body');
        return res.status(400).json({ error: 'Invalid signedPayload' });
      }

      const { signedPayload } = parsed.data;

      let verified;
      try {
        verified = await appleProvider.verifyNotification(signedPayload);
      } catch (error) {
        logger.warn({
          error: error instanceof Error ? error.message : String(error),
        }, 'Apple webhook signature verification failed');
        return res.status(401).json({ error: 'Invalid signedPayload' });
      }

      const { payload, transaction } = verified;
      const eventId = payload.notificationUUID;
      const notificationType = payload.notificationType as string;
      const subtype = payload.subtype as string | undefined;

      if (!eventId || !notificationType) {
        logger.error({ payload }, 'Apple webhook: missing notificationUUID or notificationType');
        return res.status(400).json({ error: 'Invalid notification' });
      }

      if (await refundService.isDuplicateWebhookEvent(eventId)) {
        logger.info({ eventId, notificationType }, 'Duplicate Apple webhook, skipping');
        return res.status(200).json({ status: 'duplicate' });
      }

      const recorded = await refundService.recordWebhookEvent(
        eventId,
        'apple',
        notificationType,
        JSON.stringify({ payload, transaction }),
      );
      if (!recorded) {
        logger.info({ eventId }, 'Apple webhook: concurrent duplicate detected');
        return res.status(200).json({ status: 'duplicate' });
      }

      const result = await paymentService.handleAppleNotification(
        notificationType,
        subtype,
        transaction
          ? {
              originalTransactionId: transaction.originalTransactionId,
              transactionId: transaction.transactionId,
              productId: transaction.productId,
              expiresDate: transaction.expiresDate,
              purchaseDate: transaction.purchaseDate,
              revocationDate: transaction.revocationDate,
            }
          : undefined,
      );

      logger.info({
        eventId,
        notificationType,
        subtype,
        result,
      }, 'Apple webhook handled');

      return res.status(200).json({ status: result });
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
      }, 'Apple webhook processing failed');
      return res.status(500).json({ error: 'Internal error' });
    }
  }

  async nicepayWebhook(req: Request, res: Response) {
    const rawBody = (req as Request & { rawBody?: string }).rawBody;

    if (!req.body?.tid) {
      logger.info('NicePay webhook: registration test ping (no tid), returning 200');
      return res.status(200).send('OK');
    }

    const body = req.body;
    const { tid, orderId, resultCode, resultMsg, cancelAmt } = body;

    if (!tid) {
      logger.error('NicePay webhook: missing tid');
      return res.status(400).json({ error: 'Missing tid' });
    }

    if (!nicePayProvider.verifyWebhookSignature(body)) {
      logger.warn({ tid, orderId }, 'NicePay webhook: signature verification failed, rejecting');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    if (resultCode !== '0000') {
      logger.warn({ tid, resultCode, resultMsg }, 'NicePay webhook: non-success resultCode, skipping processing');
      return res.status(200).send('OK');
    }

    const eventId = body.cancelNum || `nicepay_${tid}`;

    const result = await refundService.processNicePayRefund({
      eventId,
      tid,
      orderId,
      amount: cancelAmt || body.amount,
      resultCode,
      resultMsg,
      rawPayload: rawBody || JSON.stringify(body),
    });

    logger.info({
      eventId,
      tid,
      orderId,
      processed: result.processed,
      reason: result.reason,
    }, 'NicePay refund webhook handled');

    return res.status(200).send('OK');
  }
}

export const paymentController = new PaymentController();
