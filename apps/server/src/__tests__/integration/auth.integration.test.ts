import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { db } from '../../db';
import * as schema from '../../db/schema';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

describe('Auth Integration Tests', () => {
  let testUserEmail = 'integration-test@test.com';
  let testUserId: string;

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
      nickname: 'Integration Test',
      name: 'Test User',
    });
  });

  afterAll(async () => {
    // Cleanup
    await db.delete(schema.userProfiles).where(eq(schema.userProfiles.userId, testUserId));
    await db.delete(schema.users).where(eq(schema.users.id, testUserId));
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUserEmail,
          password: 'test1234',
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user).toHaveProperty('email', testUserEmail);
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should return 401 with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUserEmail,
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should return 400 with missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUserEmail,
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/auth/signup', () => {
    it('should create new user successfully', async () => {
      const newEmail = `newuser-${Date.now()}@test.com`;
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          email: newEmail,
          password: 'password123',
          nickname: 'New User',
          name: 'New User',
          phone: '01012345678',
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user).toHaveProperty('email', newEmail);

      // Cleanup
      const newUser = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.email, newEmail),
      });
      if (newUser) {
        await db.delete(schema.userProfiles).where(eq(schema.userProfiles.userId, newUser.id));
        await db.delete(schema.users).where(eq(schema.users.id, newUser.id));
      }
    });

    it('should return 400 with duplicate email', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          email: testUserEmail,
          password: 'password123',
          nickname: 'Duplicate',
          name: 'Duplicate',
          phone: '01012345679',
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });
});
