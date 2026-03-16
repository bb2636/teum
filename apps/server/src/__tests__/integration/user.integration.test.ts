import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { db } from '../../db';
import * as schema from '../../db/schema';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

describe('User Integration Tests', () => {
  let testUserEmail = 'user-test@test.com';
  let testUserId: string;
  let authCookie: string;

  beforeAll(async () => {
    // Create test user
    const [user] = await db
      .insert(schema.users)
      .values({
        email: testUserEmail,
        passwordHash: await bcrypt.hash('test1234', 10),
        role: 'user',
      })
      .returning();
    testUserId = user.id;

    // Create profile
    await db.insert(schema.userProfiles).values({
      userId: user.id,
      nickname: 'User Test',
      name: 'Test User',
    });

    // Login to get auth cookie
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUserEmail,
        password: 'test1234',
      });
    authCookie = loginResponse.headers['set-cookie']?.[0] || '';
  });

  afterAll(async () => {
    // Cleanup
    await db.delete(schema.userProfiles).where(eq(schema.userProfiles.userId, testUserId));
    await db.delete(schema.users).where(eq(schema.users.id, testUserId));
  });

  describe('GET /api/users/profile', () => {
    it('should get user profile', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('profile');
    });

    it('should return 401 without authentication', async () => {
      await request(app).get('/api/users/profile').expect(401);
    });
  });

  describe('PUT /api/users/profile', () => {
    it('should update user profile', async () => {
      const response = await request(app)
        .put('/api/users/profile')
        .set('Cookie', authCookie)
        .send({
          nickname: 'Updated Nickname',
          name: 'Updated Name',
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('profile');
      expect(response.body.data.profile).toHaveProperty('nickname', 'Updated Nickname');
    });
  });
});
