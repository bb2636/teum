import { Router, Request, Response } from 'express';
import { termsController } from '../controllers/terms.controller';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/auth';
import { openAIProvider } from '../services/ai/openai.provider';
import { logger } from '../config/logger';

const router: Router = Router();

const translationCache = new Map<string, { text: string; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 24;

router.post('/translate', async (req: Request, res: Response) => {
  try {
    const { title, content, lang, type } = req.body;
    if (!content || !lang || lang === 'ko') {
      return res.json({ data: { title, content } });
    }

    const cacheKey = `${type}_${lang}`;
    const cached = translationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      const parsed = JSON.parse(cached.text);
      return res.json({ data: parsed });
    }

    const translated = await openAIProvider.translateTerms({ title, content, lang });
    translationCache.set(cacheKey, { text: JSON.stringify(translated), timestamp: Date.now() });
    return res.json({ data: translated });
  } catch (error) {
    logger.error('Terms translation failed', { error: error instanceof Error ? error.message : String(error) });
    return res.json({ data: { title: req.body.title, content: req.body.content } });
  }
});

// Public routes
router.get('/all', termsController.getAllTerms.bind(termsController));
router.get('/service', termsController.getServiceTerms.bind(termsController));
router.get('/privacy', termsController.getPrivacyPolicy.bind(termsController));
router.get('/payment', termsController.getPaymentTerms.bind(termsController));
router.get('/refund', termsController.getRefundTerms.bind(termsController));

// Admin routes
router.get(
  '/admin/service',
  authenticate,
  requireRole(['admin']),
  termsController.getAdminServiceTerms.bind(termsController)
);
router.get(
  '/admin/privacy',
  authenticate,
  requireRole(['admin']),
  termsController.getAdminPrivacyPolicy.bind(termsController)
);
router.put(
  '/admin/service',
  authenticate,
  requireRole(['admin']),
  termsController.updateServiceTerms.bind(termsController)
);
router.put(
  '/admin/privacy',
  authenticate,
  requireRole(['admin']),
  termsController.updatePrivacyPolicy.bind(termsController)
);
router.get(
  '/admin/payment',
  authenticate,
  requireRole(['admin']),
  termsController.getAdminPaymentTerms.bind(termsController)
);
router.get(
  '/admin/refund',
  authenticate,
  requireRole(['admin']),
  termsController.getAdminRefundTerms.bind(termsController)
);
router.put(
  '/admin/payment',
  authenticate,
  requireRole(['admin']),
  termsController.updatePaymentTerms.bind(termsController)
);
router.put(
  '/admin/refund',
  authenticate,
  requireRole(['admin']),
  termsController.updateRefundTerms.bind(termsController)
);

export default router;
