import { Router } from 'express';
import { musicController } from '../controllers/music.controller';
import { authenticate } from '../middleware/auth';

const router: Router = Router();

router.get('/download/:token', musicController.downloadByToken.bind(musicController));
router.post('/webhook/:jobId', musicController.handleWebhook.bind(musicController));

router.use(authenticate);

router.get('/jobs', musicController.getJobs.bind(musicController));
router.get('/genres', musicController.getGenres.bind(musicController));
router.post('/generate', musicController.generateMusic.bind(musicController));
router.get('/jobs/:id', musicController.getJob.bind(musicController));
router.get('/jobs/:id/download', musicController.downloadJob.bind(musicController));
router.post('/jobs/:id/download-token', musicController.createDownloadToken.bind(musicController));

export default router;
