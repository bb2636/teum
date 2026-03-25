import { userRepository } from '../repositories/user.repository';
import { logger } from '../config/logger';

export class UserService {
  async updateProfile(userId: string, data: {
    nickname?: string;
    name?: string;
    phone?: string;
    dateOfBirth?: string;
    profileImageUrl?: string;
    country?: string;
  }) {
    logger.info('Updating user profile', { userId });

    // If nickname is being updated, check if it's available
    if (data.nickname) {
      const existingProfile = await userRepository.findByNickname(data.nickname);
      if (existingProfile && existingProfile.userId !== userId) {
        throw new Error('Nickname is already taken');
      }
    }

    // Parse date of birth if provided
    const dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : undefined;

    const updateData: Record<string, any> = {};
    if (data.nickname !== undefined) updateData.nickname = data.nickname;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth;
    if (data.profileImageUrl !== undefined) updateData.profileImageUrl = data.profileImageUrl;
    if (data.country !== undefined) updateData.country = data.country;

    const profile = await userRepository.updateProfile(userId, updateData);

    return profile;
  }

  async updateUserStatus(userId: string, isActive: boolean) {
    logger.info('Updating user status', { userId, isActive });
    const user = await userRepository.updateUserStatus(userId, isActive);
    return user;
  }
}

export const userService = new UserService();
