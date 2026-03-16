import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { db } from '../../db';
import * as schema from '../../db/schema';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

describe('Diary Integration Tests', () => {
  let testUserEmail = 'diary-test@test.com';
  let testUserId: string;
  let authCookie: string;
  let testFolderId: string;

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
      nickname: 'Diary Test',
      name: 'Test User',
    });

    // Create default folder
    const [folder] = await db
      .insert(schema.folders)
      .values({
        userId: user.id,
        name: 'Test Folder',
        isDefault: true,
        color: '#F5F5DC',
      })
      .returning();
    testFolderId = folder.id;

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
    await db.delete(schema.diaries).where(eq(schema.diaries.userId, testUserId));
    await db.delete(schema.folders).where(eq(schema.folders.userId, testUserId));
    await db.delete(schema.userProfiles).where(eq(schema.userProfiles.userId, testUserId));
    await db.delete(schema.users).where(eq(schema.users.id, testUserId));
  });

  describe('POST /api/diaries', () => {
    it('should create a free-form diary', async () => {
      const response = await request(app)
        .post('/api/diaries')
        .set('Cookie', authCookie)
        .send({
          title: 'Test Diary',
          content: 'This is a test diary content',
          type: 'free_form',
          date: new Date().toISOString().split('T')[0],
          folderId: testFolderId,
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('diary');
      expect(response.body.data.diary).toHaveProperty('title', 'Test Diary');
      expect(response.body.data.diary).toHaveProperty('type', 'free_form');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/diaries')
        .send({
          title: 'Test Diary',
          content: 'This is a test diary content',
          type: 'free_form',
          date: new Date().toISOString().split('T')[0],
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/diaries', () => {
    it('should get user diaries', async () => {
      const response = await request(app)
        .get('/api/diaries')
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('diaries');
      expect(Array.isArray(response.body.data.diaries)).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      await request(app).get('/api/diaries').expect(401);
    });
  });
});
