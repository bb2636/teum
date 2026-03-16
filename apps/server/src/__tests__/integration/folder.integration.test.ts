import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { db } from '../../db';
import * as schema from '../../db/schema';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

describe('Folder Integration Tests', () => {
  let testUserEmail = 'folder-test@test.com';
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
      nickname: 'Folder Test',
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
    await db.delete(schema.folders).where(eq(schema.folders.userId, testUserId));
    await db.delete(schema.userProfiles).where(eq(schema.userProfiles.userId, testUserId));
    await db.delete(schema.users).where(eq(schema.users.id, testUserId));
  });

  describe('POST /api/folders', () => {
    it('should create a folder successfully', async () => {
      const response = await request(app)
        .post('/api/folders')
        .set('Cookie', authCookie)
        .send({
          name: 'Test Folder',
          color: '#FF5733',
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('folder');
      expect(response.body.data.folder).toHaveProperty('name', 'Test Folder');
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .post('/api/folders')
        .send({
          name: 'Test Folder',
        })
        .expect(401);
    });
  });

  describe('GET /api/folders', () => {
    it('should get user folders', async () => {
      const response = await request(app)
        .get('/api/folders')
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('folders');
      expect(Array.isArray(response.body.data.folders)).toBe(true);
    });
  });
});
