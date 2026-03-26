import { Request, Response, NextFunction } from 'express';
import { folderService } from '../services/folder.service';
import { createFolderSchema, updateFolderSchema } from '../validations/diary';

export class FolderController {
  async getFolders(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const folders = await folderService.getFolders(req.user.userId);
      res.json({
        success: true,
        data: { folders },
      });
    } catch (error) {
      next(error);
    }
  }

  async getFolder(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const folder = await folderService.getFolder(req.params.id, req.user.userId);
      res.json({
        success: true,
        data: { folder },
      });
    } catch (error) {
      next(error);
    }
  }

  async createFolder(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const input = createFolderSchema.parse(req.body);
      const folder = await folderService.createFolder(req.user.userId, input);
      res.status(201).json({
        success: true,
        data: { folder },
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'FOLDER_LIMIT_REACHED') {
        return res.status(403).json({
          success: false,
          error: { code: 'FOLDER_LIMIT_REACHED', message: 'Free users can create up to 2 folders before writing 3 diaries' },
        });
      }
      next(error);
    }
  }

  async updateFolder(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const input = updateFolderSchema.parse(req.body);
      const folder = await folderService.updateFolder(req.params.id, req.user.userId, input);
      res.json({
        success: true,
        data: { folder },
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteFolder(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      await folderService.deleteFolder(req.params.id, req.user.userId);
      res.json({
        success: true,
        message: 'Folder deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const folderController = new FolderController();
