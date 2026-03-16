import { folderRepository } from '../repositories/folder.repository';

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
