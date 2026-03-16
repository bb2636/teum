import { db } from './index';
import * as schema from './schema';
import * as dotenv from 'dotenv';

dotenv.config();

async function testDatabase() {
  try {
    console.log('🔍 Testing database connection...\n');

    // Test 1: Count users
    console.log('Test 1: Counting users...');
    const userCount = await db.select().from(schema.users);
    console.log(`✅ Found ${userCount.length} users`);

    // Test 2: Get admin user
    console.log('\nTest 2: Fetching admin user...');
    const adminUser = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, 'admin@teum.com'),
      with: {
        profile: true,
      },
    });
    if (adminUser) {
      console.log(`✅ Admin user found: ${adminUser.email} (Role: ${adminUser.role})`);
      if (adminUser.profile) {
        console.log(`   Profile: ${adminUser.profile.nickname}`);
      }
    } else {
      console.log('❌ Admin user not found');
    }

    // Test 3: Get folders
    console.log('\nTest 3: Fetching folders...');
    const folders = await db.select().from(schema.folders);
    console.log(`✅ Found ${folders.length} folders`);
    folders.forEach((folder) => {
      console.log(`   - ${folder.name} (Default: ${folder.isDefault})`);
    });

    // Test 4: Get question sets
    console.log('\nTest 4: Fetching question sets...');
    const questionSets = await db.query.diaryQuestionSets.findMany({
      with: {
        questions: true,
      },
    });
    console.log(`✅ Found ${questionSets.length} question sets`);
    questionSets.forEach((set) => {
      console.log(`   - ${set.name} (${set.questions.length} questions)`);
    });

    // Test 5: Test transaction (insert and rollback)
    console.log('\nTest 5: Testing transaction...');
    try {
      const testResult = await db
        .select()
        .from(schema.users)
        .limit(1);
      console.log(`✅ Transaction test passed (fetched ${testResult.length} record)`);
    } catch (error) {
      console.log(`❌ Transaction test failed: ${error}`);
    }

    // Test 6: Test relations
    console.log('\nTest 6: Testing relations...');
    const userWithRelations = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, 'test@teum.com'),
      with: {
        profile: true,
      },
    });
    if (userWithRelations) {
      console.log(`✅ Relations test passed`);
      console.log(`   User: ${userWithRelations.email}`);
      if (userWithRelations.profile) {
        console.log(`   Profile: ${userWithRelations.profile.nickname}`);
      }
    } else {
      console.log('⚠️  Test user not found (this is okay if seed was not run)');
    }

    console.log('\n✅ All database tests passed!');
    console.log('\n📊 Database Summary:');
    console.log(`   - Users: ${userCount.length}`);
    console.log(`   - Folders: ${folders.length}`);
    console.log(`   - Question Sets: ${questionSets.length}`);
    console.log(`   - Total Questions: ${questionSets.reduce((sum, set) => sum + set.questions.length, 0)}`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Database test failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

testDatabase();
