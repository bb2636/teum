import { Router } from 'express';
import { folderController } from '../controllers/folder.controller';
import { authenticate } from '../middleware/auth';

const router: Router = Router();

router.use(authenticate);

router.get('/', folderController.getFolders.bind(folderController));
router.get('/:id', folderController.getFolder.bind(folderController));
router.post('/', folderController.createFolder.bind(folderController));
router.put('/:id', folderController.updateFolder.bind(folderController));
router.delete('/:id', folderController.deleteFolder.bind(folderController));

export default router;
