import { userRepository } from '../repositories/user.repository';
import { logger } from '../config/logger';
import { emailService } from './email/email.service';

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

    if (data.nickname) {
      const existingProfile = await userRepository.findByNickname(data.nickname);
      if (existingProfile && existingProfile.userId !== userId) {
        throw new Error('Nickname is already taken');
      }
    }

    const dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : undefined;

    const updateData: Record<string, any> = {};
    if (data.nickname !== undefined) updateData.nickname = data.nickname;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth;
    if (data.profileImageUrl !== undefined) updateData.profileImageUrl = data.profileImageUrl;
    if (data.country !== undefined) updateData.country = data.country;

    const currentUser = await userRepository.findByIdWithProfile(userId);
    const currentProfile = (currentUser as any)?.profile;

    const profile = await userRepository.updateProfile(userId, updateData);

    const fieldMap: Record<string, string> = {
      nickname: 'nickname',
      name: 'name',
      phone: 'phone',
      dateOfBirth: 'dateOfBirth',
      profileImageUrl: 'profileImageUrl',
      country: 'country',
    };

    const actuallyChangedFields: string[] = [];
    for (const [key, profileKey] of Object.entries(fieldMap)) {
      const newVal = (data as any)[key];
      if (newVal === undefined) continue;
      const oldVal = currentProfile?.[profileKey];
      const normalizedOld = oldVal instanceof Date ? oldVal.toISOString().split('T')[0] : (oldVal ?? '');
      const normalizedNew = key === 'dateOfBirth' && newVal ? new Date(newVal).toISOString().split('T')[0] : (newVal ?? '');
      if (String(normalizedOld) !== String(normalizedNew)) {
        actuallyChangedFields.push(key);
      }
    }

    if (actuallyChangedFields.length > 0 && currentUser?.email) {
      const nickname = currentProfile?.nickname || '회원';
      emailService.sendProfileUpdateNotification(currentUser.email, nickname, actuallyChangedFields).catch((err: unknown) => logger.warn('Profile update notification email failed', { error: err instanceof Error ? err.message : String(err) }));
    }

    return profile;
  }

  async updateUserStatus(userId: string, isActive: boolean) {
    logger.info('Updating user status', { userId, isActive });
    const user = await userRepository.updateUserStatus(userId, isActive);
    return user;
  }
}

export const userService = new UserService();
