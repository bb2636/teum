import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { db } from '../../db';
import * as schema from '../../db/schema';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

/**
 * E2E Test: Basic User Flow
 * 
 * Tests the complete flow of:
 * 1. User signup
 * 2. User login
 * 3. Create folder
 * 4. Create diary
 * 5. Get diaries
 * 6. Update profile
 */
describe('E2E: Basic User Flow', () => {
  let testUserEmail = `e2e-test-${Date.now()}@test.com`;
  let testUserId: string;
  let authCookie: string;
  let folderId: string;
  let diaryId: string;

  afterAll(async () => {
    // Cleanup
    if (testUserId) {
      await db.delete(schema.diaries).where(eq(schema.diaries.userId, testUserId));
      await db.delete(schema.folders).where(eq(schema.folders.userId, testUserId));
      await db.delete(schema.userProfiles).where(eq(schema.userProfiles.userId, testUserId));
      await db.delete(schema.users).where(eq(schema.users.id, testUserId));
    }
  });

  it('should complete full user flow', async () => {
    // Step 1: Signup
    const signupResponse = await request(app)
      .post('/api/auth/signup')
      .send({
        email: testUserEmail,
        password: 'test1234',
        nickname: 'E2E Test User',
        name: 'E2E Test',
        phone: '01012345678',
      })
      .expect(201);

    expect(signupResponse.body).toHaveProperty('success', true);
    expect(signupResponse.body.data.user).toHaveProperty('email', testUserEmail);
    testUserId = signupResponse.body.data.user.id;

    // Step 2: Login
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUserEmail,
        password: 'test1234',
      })
      .expect(200);

    expect(loginResponse.body).toHaveProperty('success', true);
    authCookie = loginResponse.headers['set-cookie']?.[0] || '';
    expect(authCookie).toBeTruthy();

    // Step 3: Get profile
    const profileResponse = await request(app)
      .get('/api/users/profile')
      .set('Cookie', authCookie)
      .expect(200);

    expect(profileResponse.body.data.profile).toHaveProperty('nickname', 'E2E Test User');

    // Step 4: Create folder
    const folderResponse = await request(app)
      .post('/api/folders')
      .set('Cookie', authCookie)
      .send({
        name: 'E2E Test Folder',
        color: '#FF5733',
      })
      .expect(201);

    expect(folderResponse.body.data.folder).toHaveProperty('name', 'E2E Test Folder');
    folderId = folderResponse.body.data.folder.id;

    // Step 5: Create diary
    const diaryResponse = await request(app)
      .post('/api/diaries')
      .set('Cookie', authCookie)
      .send({
        title: 'E2E Test Diary',
        content: 'This is an E2E test diary',
        type: 'free_form',
        date: new Date().toISOString().split('T')[0],
        folderId: folderId,
      })
      .expect(201);

    expect(diaryResponse.body.data.diary).toHaveProperty('title', 'E2E Test Diary');
    diaryId = diaryResponse.body.data.diary.id;

    // Step 6: Get diaries
    const diariesResponse = await request(app)
      .get('/api/diaries')
      .set('Cookie', authCookie)
      .expect(200);

    expect(diariesResponse.body.data.diaries).toBeInstanceOf(Array);
    expect(diariesResponse.body.data.diaries.length).toBeGreaterThan(0);

    // Step 7: Update profile
    const updateProfileResponse = await request(app)
      .put('/api/users/profile')
      .set('Cookie', authCookie)
      .send({
        nickname: 'Updated E2E User',
      })
      .expect(200);

    expect(updateProfileResponse.body.data.profile).toHaveProperty('nickname', 'Updated E2E User');
  });
});
