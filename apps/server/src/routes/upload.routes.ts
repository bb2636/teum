import { Router } from 'express';
import { uploadController } from '../controllers/upload.controller';
import { authenticate } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router: Router = Router();

router.use(authenticate);
router.post(
  '/image',
  upload.single('image'),
  uploadController.uploadImage.bind(uploadController)
);

export default router;
