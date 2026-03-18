import express, { Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middleware/error-handler';
import { setCacheHeaders } from './middleware/cache-headers';
import { performanceMiddleware } from './middleware/performance';
import { performanceMonitor } from './utils/performance-monitor';
import { authenticate } from './middleware/auth';
import { requireRole } from './middleware/auth';
import { adapter } from './storage';

export const app: Express = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(setCacheHeaders);
app.use(performanceMiddleware);

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

// Root path
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

// Error handler (must be last)
app.use(errorHandler);
