import { folderRepository } from '../repositories/folder.repository';
import { diaryRepository } from '../repositories/diary.repository';
import { paymentService } from './payment.service';

const FREE_USER_MAX_FOLDERS = 2;
const FREE_USER_DIARY_THRESHOLD = 3;

export class FolderService {
  async getFolders(userId: string) {
    return folderRepository.findByUserId(userId);
  }

  async getFolder(id: string, userId: string) {
    const folder = await folderRepository.findById(id);
    if (!folder || folder.userId !== userId) {
      throw new Error('Folder not found');
    }
    return folder;
  }

  async createFolder(userId: string, data: {
    name: string;
    coverImageUrl?: string;
    color?: string;
  }) {
    const activeSub = await paymentService.getActiveSubscription(userId);
    if (!activeSub) {
      const diaryCount = await diaryRepository.countByUserId(userId);
      if (diaryCount < FREE_USER_DIARY_THRESHOLD) {
        const allFolders = await folderRepository.findByUserId(userId);
        const nonDefaultCount = allFolders.filter(f => !f.isDefault).length;
        if (nonDefaultCount >= FREE_USER_MAX_FOLDERS) {
          throw new Error('FOLDER_LIMIT_REACHED');
        }
      }
    }

    return folderRepository.create({
      userId,
      name: data.name,
      coverImageUrl: data.coverImageUrl,
      color: data.color,
      isDefault: false,
    });
  }

  async updateFolder(id: string, userId: string, data: {
    name?: string;
    coverImageUrl?: string;
    color?: string;
  }) {
    const folder = await folderRepository.findById(id);
    if (!folder || folder.userId !== userId) {
      throw new Error('Folder not found');
    }

    return folderRepository.update(id, data);
  }

  async deleteFolder(id: string, userId: string) {
    const folder = await folderRepository.findById(id);
    if (!folder || folder.userId !== userId) {
      throw new Error('Folder not found');
    }

    // Don't allow deleting default folder
    if (folder.isDefault) {
      throw new Error('Cannot delete default folder');
    }

    await folderRepository.delete(id);
  }
}

export const folderService = new FolderService();
