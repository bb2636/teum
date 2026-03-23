import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../db';
import { users, userProfiles, folders, authAccounts } from '../db/schema';

export class UserRepository {
  async findByEmail(email: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);
    return user;
  }

  async findById(id: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);
    return user;
  }

  async findByIdWithProfile(id: string) {
    const user = await db.query.users.findFirst({
      where: (users, { eq, and, isNull }) =>
        and(eq(users.id, id), isNull(users.deletedAt)),
      with: {
        profile: true,
      },
    });
    return user;
  }

  async createUser(data: {
    email: string;
    passwordHash: string;
    role?: 'user' | 'admin';
  }) {
    const [user] = await db
      .insert(users)
      .values({
        email: data.email,
        passwordHash: data.passwordHash,
        role: data.role || 'user',
      })
      .returning();
    return user;
  }

  async createProfile(data: {
    userId: string;
    nickname: string;
    name: string;
    phone?: string;
    dateOfBirth?: Date;
    profileImageUrl?: string;
    country?: string;
  }) {
    const [profile] = await db
      .insert(userProfiles)
      .values({
        userId: data.userId,
        nickname: data.nickname,
        name: data.name,
        phone: data.phone,
        dateOfBirth: data.dateOfBirth,
        profileImageUrl: data.profileImageUrl,
        country: data.country,
      })
      .returning();
    return profile;
  }

  async createDefaultFolder(userId: string) {
    const [folder] = await db
      .insert(folders)
      .values({
        userId,
        name: 'All',
        isDefault: true,
        color: '#F5F5DC',
      })
      .returning();
    return folder;
  }

  async createAuthAccount(data: {
    userId: string;
    provider: 'email' | 'google';
    providerAccountId: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: Date;
  }) {
    const [account] = await db
      .insert(authAccounts)
      .values({
        userId: data.userId,
        provider: data.provider,
        providerAccountId: data.providerAccountId,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
      })
      .returning();
    return account;
  }

  async findAuthAccount(provider: 'email' | 'google', providerAccountId: string) {
    const [account] = await db
      .select()
      .from(authAccounts)
      .where(
        and(
          eq(authAccounts.provider, provider),
          eq(authAccounts.providerAccountId, providerAccountId)
        )
      )
      .limit(1);
    return account;
  }

  async findByEmailAndPhone(email: string, phone: string) {
    const user = await db.query.users.findFirst({
      where: (users, { eq, and, isNull }) =>
        and(eq(users.email, email), isNull(users.deletedAt)),
      with: {
        profile: true,
      },
    });
    if (user && user.profile && user.profile.phone === phone) {
      return user;
    }
    return null;
  }

  async findByEmailIncludingDeleted(email: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return user;
  }

  async softDeleteUser(userId: string) {
    await db
      .update(users)
      .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async findByNickname(nickname: string) {
    const profile = await db.query.userProfiles.findFirst({
      where: (profiles, { eq }) => eq(profiles.nickname, nickname),
      with: {
        user: true,
      },
    });
    // Only return if user exists and is not deleted
    if (profile && profile.user && !profile.user.deletedAt) {
      return profile;
    }
    return null;
  }

  async updateProfile(userId: string, data: {
    nickname?: string;
    name?: string;
    phone?: string;
    dateOfBirth?: Date;
    profileImageUrl?: string;
    country?: string;
  }) {
    const [profile] = await db
      .update(userProfiles)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.userId, userId))
      .returning();
    return profile;
  }

  async updatePassword(userId: string, passwordHash: string) {
    await db
      .update(users)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async updateUserStatus(userId: string, isActive: boolean) {
    const [updated] = await db
      .update(users)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async findAllWithProfiles() {
    return await db.query.users.findMany({
      with: {
        profile: true,
      },
      orderBy: (users, { desc }) => [desc(users.createdAt)],
    });
  }
}

export const userRepository = new UserRepository();
