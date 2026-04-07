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
          sortOrder: i + 1,
        });
      } else {
        // Update order if exists
        await db
          .update(schema.questions)
          .set({ sortOrder: i + 1, isActive: true })
          .where(eq(schema.questions.id, existingQuestion.id));
      }
    }
    console.log('Sample questions created/updated');

    const privacyContent = `개인정보처리방침

시행일: 2025년 1월 1일

1. 개인정보의 수집 항목 및 수집 방법

Teum(이하 "서비스")은 서비스 제공을 위해 아래의 개인정보를 수집합니다.

가. 회원가입 시 수집 항목
- 이메일 주소, 비밀번호(이메일 가입의 경우)
- 소셜 로그인 시: 이름, 이메일 주소, 프로필 사진, 소셜 계정 고유 식별자
- 닉네임, 생년월일, 성별, 국가

나. 서비스 이용 과정에서 수집되는 항목
- 일기 내용(텍스트, 이미지)
- AI 분석 결과(감정 분석, 요약)
- 음악 생성 기록
- 결제 정보(결제 수단, 결제 일시, 구독 상태)
- 기기 정보, 접속 로그, IP 주소

다. 수집 방법
회원가입, 소셜 로그인(Google, Apple), 서비스 이용 과정에서 자동 수집

2. 개인정보의 수집 및 이용 목적

- 회원 식별 및 본인 인증
- 일기 작성, 저장 및 관리 서비스 제공
- AI 기반 감정 분석 및 음악 생성 서비스 제공
- 구독 결제 처리 및 관리
- 고객 문의 대응 및 서비스 개선
- 서비스 이용 통계 분석

3. 개인정보의 보유 및 이용 기간

- 회원 탈퇴 시까지 보유하며, 탈퇴 후 지체 없이 파기합니다.
- 단, 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.
  - 계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래법)
  - 대금결제 및 재화 등의 공급에 관한 기록: 5년 (전자상거래법)
  - 소비자 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래법)
  - 접속에 관한 기록: 3개월 (통신비밀보호법)

4. 개인정보의 제3자 제공

서비스는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만, 아래의 경우에는 예외로 합니다.
- 이용자가 사전에 동의한 경우
- 법령의 규정에 의하거나, 수사 목적으로 법령에 정해진 절차에 따라 요청이 있는 경우

5. 개인정보 처리 위탁

서비스는 원활한 서비스 제공을 위해 아래와 같이 개인정보 처리를 위탁합니다.

수탁업체 | 위탁 업무
Google LLC | 소셜 로그인 인증
Apple Inc. | 소셜 로그인 인증
OpenAI | AI 감정 분석 및 음악 생성
나이스페이먼츠 | 결제 처리

6. 이용자의 권리 및 행사 방법

이용자는 언제든지 다음의 권리를 행사할 수 있습니다.
- 개인정보 열람, 정정, 삭제 요청
- 개인정보 처리 정지 요청
- 회원 탈퇴

위 권리는 앱 내 설정 또는 고객센터를 통해 행사할 수 있습니다.

7. 개인정보의 안전성 확보 조치

- 비밀번호 암호화 저장(bcrypt)
- SSL/TLS를 통한 데이터 전송 암호화
- 접근 권한 제한 및 관리
- 개인정보 접근 로그 기록 및 관리

8. 개인정보 보호책임자

이메일: iteraon.teum@gmail.com
개인정보 관련 문의사항은 위 이메일로 연락해 주시기 바랍니다.

9. 개인정보처리방침의 변경

본 개인정보처리방침은 법령 및 서비스 변경사항을 반영하여 수정될 수 있으며, 변경 시 앱 내 공지를 통해 안내합니다.

© Teum. All rights reserved.`;

    const existingPrivacy = await db.query.terms.findFirst({
      where: (t, { eq, isNull, and }) => and(eq(t.type, 'privacy'), isNull(t.deletedAt)),
    });

    if (!existingPrivacy) {
      await db.insert(schema.terms).values({
        type: 'privacy',
        version: '1.0',
        content: privacyContent,
      });
      console.log('Privacy policy terms created');
    } else {
      console.log('Privacy policy terms already exists');
    }

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
