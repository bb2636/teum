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

    const profile = await userRepository.updateProfile(userId, {
      nickname: data.nickname,
      name: data.name,
      phone: data.phone,
      dateOfBirth,
      profileImageUrl: data.profileImageUrl,
      country: data.country,
    });

    return profile;
  }
}

export const userService = new UserService();
