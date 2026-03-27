import express, { Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { errorHandler } from './middleware/error-handler';
import { setCacheHeaders } from './middleware/cache-headers';
import { performanceMiddleware } from './middleware/performance';
import { performanceMonitor } from './utils/performance-monitor';
import { authenticate } from './middleware/auth';
import { requireRole } from './middleware/auth';
import { adapter } from './storage';
import { globalApiLimiter } from './middleware/rate-limiter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app: Express = express();

// Trust proxy for accurate IP detection (behind reverse proxy/load balancer)
app.set('trust proxy', true);

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.CORS_ORIGIN,
      process.env.FRONTEND_URL,
      'http://localhost:3000',
      'http://localhost:5000',
      'https://teum.replit.app',
      'capacitor://localhost',
      'http://localhost',
      'https://localhost',
      'https://pay.nicepay.co.kr',
      'https://sandbox-pay.nicepay.co.kr',
    ].filter(Boolean) as string[];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else if (origin && (origin.endsWith('.replit.dev') || origin.endsWith('.replit.app')) && (
      (process.env.REPLIT_DEV_DOMAIN && origin.includes(process.env.REPLIT_DEV_DOMAIN.replace(/:\d+$/, ''))) ||
      origin.includes('teum')
    )) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(setCacheHeaders);
app.use(performanceMiddleware);
app.use('/api/music', (req, _res, next) => {
  console.log(`[MUSIC-REQ] ${req.method} ${req.path} cookies=${Object.keys(req.cookies || {}).join(',')}`);
  next();
});
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
import pushNotificationRoutes from './routes/push-notification.routes';
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
app.use('/api/push', pushNotificationRoutes);

// Serve uploaded images (memory adapter: /storage/uploads/... → GET /api/storage/uploads/...)
// This endpoint is public (no authentication required) to allow image access
app.get(/^\/api\/storage\/(.+)$/, async (req, res) => {
  const path = (req.params as Record<string, string>)[0];
  if (!path) {
    return res.status(404).json({ success: false, error: { message: 'Not found' } });
  }
  if (!adapter.get) {
    return res.status(404).json({ success: false, error: { message: 'Storage not serveable' } });
  }
  try {
    const file = await adapter.get(path);
    if (!file) {
      return res.status(404).json({ success: false, error: { message: 'File not found' } });
    }
    res.setHeader('Content-Type', file.mimetype);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    res.send(file.buffer);
  } catch (error) {
    console.error('Storage get error:', error);
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
