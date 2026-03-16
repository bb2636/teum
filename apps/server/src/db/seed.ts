import { db } from './index';
import * as schema from './schema';
import * as dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

dotenv.config();

async function seed() {
  try {
    console.log('Seeding database...');

    // Check if admin user exists, if not create it
    let adminUser = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, 'admin@teum.com'),
    });

    if (!adminUser) {
      // Create admin user
      [adminUser] = await db
        .insert(schema.users)
        .values({
          email: 'admin@teum.com',
          passwordHash: await bcrypt.hash('admin1234', 10),
          role: 'admin',
        })
        .returning();
      console.log('Admin user created');
    } else {
      // Update admin password if exists
      await db
        .update(schema.users)
        .set({
          passwordHash: await bcrypt.hash('admin1234', 10),
          role: 'admin',
        })
        .where(eq(schema.users.id, adminUser.id));
      console.log('Admin user password updated');
    }

    // Check if admin profile exists
    const adminProfile = await db.query.userProfiles.findFirst({
      where: (profiles, { eq }) => eq(profiles.userId, adminUser.id),
    });

    if (!adminProfile) {
      // Create admin profile
      await db.insert(schema.userProfiles).values({
        userId: adminUser.id,
        nickname: 'Admin',
        name: 'Administrator',
      });
      console.log('Admin profile created');
    } else {
      // Update admin profile
      await db
        .update(schema.userProfiles)
        .set({
          nickname: 'Admin',
          name: 'Administrator',
        })
        .where(eq(schema.userProfiles.userId, adminUser.id));
      console.log('Admin profile updated');
    }

    // Check if test user exists, if not create it
    let testUser = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, 'test@test.com'),
    });

    if (!testUser) {
      // Create test user
      [testUser] = await db
        .insert(schema.users)
        .values({
          email: 'test@test.com',
          passwordHash: await bcrypt.hash('test1234', 10),
          role: 'user',
        })
        .returning();
      console.log('Test user created');
    } else {
      // Update test user password if exists
      await db
        .update(schema.users)
        .set({
          passwordHash: await bcrypt.hash('test1234', 10),
        })
        .where(eq(schema.users.id, testUser.id));
      console.log('Test user password updated');
    }

    // Check if test user profile exists
    const testProfile = await db.query.userProfiles.findFirst({
      where: (profiles, { eq }) => eq(profiles.userId, testUser.id),
    });

    if (!testProfile) {
      // Create test user profile
      await db.insert(schema.userProfiles).values({
        userId: testUser.id,
        nickname: 'Test User',
        name: 'Test User',
      });
      console.log('Test user profile created');
    } else {
      // Update test user profile
      await db
        .update(schema.userProfiles)
        .set({
          nickname: 'Test User',
          name: 'Test User',
        })
        .where(eq(schema.userProfiles.userId, testUser.id));
      console.log('Test user profile updated');
    }

    // Check if default folder exists for test user
    const existingFolder = await db.query.folders.findFirst({
      where: (folders, { eq, and }) => and(
        eq(folders.userId, testUser.id),
        eq(folders.isDefault, true)
      ),
    });

    if (!existingFolder) {
      // Create default folder for test user
      await db.insert(schema.folders).values({
        userId: testUser.id,
        name: 'All',
        isDefault: true,
        color: '#F5F5DC',
      });
      console.log('Default folder created for test user');
    }

    // Create sample questions (new question system)
    const sampleQuestions = [
      '오늘 하루는 어땠나요?',
      '가장 기억에 남는 순간은?',
      '내일은 어떤 하루가 되길 바라나요?',
      '오늘 감사한 일은 무엇인가요?',
      '오늘 느낀 감정은 무엇인가요?',
      '오늘 배운 점이 있다면?',
      '내일의 목표는 무엇인가요?',
    ];

    for (let i = 0; i < sampleQuestions.length; i++) {
      const existingQuestion = await db.query.questions.findFirst({
        where: (questions, { eq }) => eq(questions.question, sampleQuestions[i]),
      });

      if (!existingQuestion) {
        await db.insert(schema.questions).values({
          question: sampleQuestions[i],
          isActive: true,
          order: i + 1,
        });
      } else {
        // Update order if exists
        await db
          .update(schema.questions)
          .set({ order: i + 1, isActive: true })
          .where(eq(schema.questions.id, existingQuestion.id));
      }
    }
    console.log('Sample questions created/updated');

    console.log('\nSeed completed successfully!');
    console.log('Admin credentials: admin@teum.com / admin1234');
    console.log('Test user credentials: test@test.com / test1234');
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

seed();
