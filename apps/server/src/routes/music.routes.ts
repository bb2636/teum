import { Router } from 'express';
import { musicController } from '../controllers/music.controller';
import { authenticate } from '../middleware/auth';

const router: Router = Router();

router.use(authenticate);

router.get('/jobs', musicController.getJobs.bind(musicController));
router.get('/genres', musicController.getGenres.bind(musicController));
router.post('/generate', musicController.generateMusic.bind(musicController));
router.get('/jobs/:id', musicController.getJob.bind(musicController));

// Webhook endpoint (no auth required - should verify webhook signature in production)
router.post('/webhook/:jobId', musicController.handleWebhook.bind(musicController));

export default router;
