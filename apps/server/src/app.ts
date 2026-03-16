import express, { Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middleware/error-handler';
import { setCacheHeaders } from './middleware/cache-headers';

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

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
import questionSetRoutes from './routes/question-set.routes';
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
app.use('/api/question-sets', questionSetRoutes);
app.use('/api/questions', questionRoutes);

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
