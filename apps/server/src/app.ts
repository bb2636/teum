import express, { Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import pinoHttp from 'pino-http';
import { errorHandler } from './middleware/error-handler';
import { setCacheHeaders } from './middleware/cache-headers';
import { performanceMiddleware } from './middleware/performance';
import { performanceMonitor } from './utils/performance-monitor';
import { authenticate } from './middleware/auth';
import { requireRole } from './middleware/auth';
import { adapter } from './storage';
import { globalApiLimiter } from './middleware/rate-limiter';
import { csrfProtection } from './middleware/csrf';
import { verifySignedToken } from './utils/signed-url';
import { logger } from './config/logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app: Express = express();

// Trust proxy for accurate IP detection (behind reverse proxy/load balancer)
app.set('trust proxy', true);

// HTTP request logger — logs every request with method, path, status, response time
app.use(pinoHttp({
  logger,
  // Skip noisy health checks from logs
  autoLogging: {
    ignore: (req) => req.url === '/health',
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} ${res.statusCode} — ${err?.message ?? 'error'}`;
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
}));

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // 운영 도메인은 정확 일치만 허용 (substring 매칭은 유사도메인 우회 위험).
    const allowedOrigins = [
      process.env.CORS_ORIGIN,
      process.env.FRONTEND_URL,
      'http://localhost:3000',
      'http://localhost:5000',
      'https://teum--iteraon.replit.app',
      'capacitor://localhost',
      'http://localhost',
      'https://localhost',
      'https://pay.nicepay.co.kr',
      'https://sandbox-pay.nicepay.co.kr',
      'https://appleid.apple.com',
    ].filter(Boolean) as string[];

    // 작업환경 (Replit dev) 만 허용: 현재 사용중인 REPLIT_DEV_DOMAIN 과 정확히 일치할 때만.
    if (process.env.REPLIT_DEV_DOMAIN) {
      const devOrigin = `https://${process.env.REPLIT_DEV_DOMAIN.replace(/:\d+$/, '')}`;
      allowedOrigins.push(devOrigin);
    }

    if (!origin || origin === 'null' || allowedOrigins.includes(origin)) {
      // null origin 은 여기서 CORS preflight 만 통과시키고, 실제 인증 보호는 CSRF 미들웨어
      // (Bearer 토큰 동반 시에만 허용) 가 담당한다.
      return callback(null, true);
    }
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
}));
app.use(express.json({
  verify: (req, _res, buf) => {
    const url = (req as express.Request).originalUrl || (req as express.Request).url || '';
    if (url.includes('/webhook')) {
      (req as express.Request & { rawBody?: string }).rawBody = buf.toString('utf8');
    }
  },
}));
app.use(express.urlencoded({
  extended: true,
  verify: (req, _res, buf) => {
    const url = (req as express.Request).originalUrl || (req as express.Request).url || '';
    if (url.includes('/webhook')) {
      (req as express.Request & { rawBody?: string }).rawBody = buf.toString('utf8');
    }
  },
}));
app.use(cookieParser());
app.use(setCacheHeaders);
app.use(performanceMiddleware);
app.use('/api', csrfProtection);
app.use('/api', globalApiLimiter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Performance metrics endpoint (admin only)
app.get('/api/admin/performance', authenticate, requireRole(['admin']), (_req, res) => {
  const queryStats = performanceMonitor.getQueryStats();
  const endpointStats = performanceMonitor.getEndpointStats();
  
  res.json({
    success: true,
    data: {
      queries: queryStats,
      endpoints: endpointStats,
    },
  });
});

// API routes
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import folderRoutes from './routes/folder.routes';
import diaryRoutes from './routes/diary.routes';
import uploadRoutes from './routes/upload.routes';
import aiRoutes from './routes/ai.routes';
import musicRoutes from './routes/music.routes';
import paymentRoutes from './routes/payment.routes';
import supportRoutes from './routes/support.routes';
import termsRoutes from './routes/terms.routes';
import passwordResetRoutes from './routes/password-reset.routes';
import questionRoutes from './routes/question.routes';
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/diaries', diaryRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/terms', termsRoutes);
app.use('/api/password-reset', passwordResetRoutes);
app.use('/api/questions', questionRoutes);

app.get(/^\/api\/storage\/(.+)$/, async (req, res) => {
  const filePath = (req.params as Record<string, string>)[0];
  if (!filePath) {
    return res.status(404).json({ success: false, error: { message: 'Not found' } });
  }
  if (!adapter.get) {
    return res.status(404).json({ success: false, error: { message: 'Storage not serveable' } });
  }

  const token = req.query.token as string | undefined;
  let authorized = false;

  if (token) {
    const result = verifySignedToken(token);
    authorized = result.valid === true && result.path === filePath;
  }

  if (!authorized) {
    try {
      const cookieToken = req.cookies?.accessToken;
      if (cookieToken) {
        const { verifyAccessToken } = await import('./utils/jwt');
        const payload = verifyAccessToken(cookieToken);
        if (payload) {
          // storage 인증은 tokenVersion 캐시(30초 TTL) 를 사용해 DB 부하 절감
          const { getTokenVersionCached } = await import('./middleware/auth');
          const currentVersion = await getTokenVersionCached(payload.userId);
          if (currentVersion !== null && payload.tokenVersion !== undefined && payload.tokenVersion === currentVersion) {
            authorized = true;
          }
        }
      }
    } catch {}
  }

  if (!authorized) {
    return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
  }

  try {
    const file = await adapter.get(filePath);
    if (!file) {
      return res.status(404).json({ success: false, error: { message: 'File not found' } });
    }
    res.setHeader('Content-Type', file.mimetype);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.send(file.buffer);
  } catch {
    res.status(404).json({ success: false, error: { message: 'Not found' } });
  }
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `API endpoint not found: ${req.method} ${req.path}`,
    },
  });
});

// In production, serve the frontend build
if (process.env.NODE_ENV === 'production') {
  const webDistPath = path.resolve(__dirname, '../../web/dist');
  app.use(express.static(webDistPath, {
    etag: false,
    lastModified: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    },
  }));
  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(webDistPath, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.json({
      message: 'Teum API Server',
      version: '1.0.0',
      endpoints: {
        health: '/health',
        api: '/api',
      },
    });
  });
}

// Error handler (must be last)
app.use(errorHandler);
