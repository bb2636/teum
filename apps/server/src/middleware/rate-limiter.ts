import rateLimit from 'express-rate-limit';

function normalizeIp(ip: string | undefined): string {
  if (!ip) return 'unknown';
  if (ip.startsWith('::ffff:')) return ip.slice(7);
  return ip;
}

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: '로그인 시도가 너무 많습니다. 15분 후에 다시 시도해주세요.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.body?.email || normalizeIp(req.ip);
  },
  validate: false,
});

export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: '회원가입 요청이 너무 많습니다. 1시간 후에 다시 시도해주세요.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});

export const verificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: '인증번호 요청이 너무 많습니다. 1시간 후에 다시 시도해주세요.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.body?.phone || req.body?.email || normalizeIp(req.ip);
  },
  validate: false,
});

export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: '비밀번호 재설정 요청이 너무 많습니다. 1시간 후에 다시 시도해주세요.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.body?.email || normalizeIp(req.ip);
  },
  validate: false,
});

export const globalApiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});
