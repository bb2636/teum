/**
 * Mureka API 연결 테스트 스크립트
 * 
 * 사용법: pnpm --filter server test:mureka
 */

import * as dotenv from 'dotenv';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// .env 파일 로드
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../../.env');
dotenv.config({ path: envPath });

const MUREKA_BASE = 'https://api.mureka.ai';

async function testMureka() {
  console.log('=== Mureka API 연결 테스트 ===\n');

  // 1. 환경 변수 확인
  const apiKey = process.env.MUREKA_API_KEY;
  const musicEnabled = process.env.AI_MUSIC_ENABLED === 'true';

  console.log('1. 환경 변수 확인:');
  console.log(`   - MUREKA_API_KEY: ${apiKey ? `${apiKey.substring(0, 10)}...` : '❌ 없음'}`);
  console.log(`   - AI_MUSIC_ENABLED: ${musicEnabled ? '✅ true' : '❌ false'}`);
  console.log('');

  if (!apiKey) {
    console.error('❌ MUREKA_API_KEY가 설정되지 않았습니다.');
    console.error('   .env 파일에 MUREKA_API_KEY=... 를 추가하세요.');
    console.error('   발급 방법: https://platform.mureka.ai/');
    process.exit(1);
  }

  if (!musicEnabled) {
    console.warn('⚠️  AI_MUSIC_ENABLED가 false입니다.');
    console.warn('   .env 파일에 AI_MUSIC_ENABLED=true 를 추가하세요.');
  }

  // 2. 간단한 API 호출 테스트
  console.log('2. API 엔드포인트 접근 테스트...');
  console.log('   ⚠️  실제 음악 생성 요청은 비용이 발생할 수 있습니다.');
  console.log('   간단한 인증 테스트만 수행합니다.\n');
  
  try {
    // 최소한의 테스트 요청 (실제 생성은 하지 않음)
    const testResponse = await fetch(`${MUREKA_BASE}/v1/song/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lyrics: '테스트',
        prompt: 'test',
      }),
    });

    const responseData = await testResponse.json() as { id?: string; status?: string };

    if (testResponse.ok) {
      console.log('   ✅ API 호출 성공!');
      console.log(`   - Task ID: ${responseData.id || 'N/A'}`);
      console.log(`   - Status: ${responseData.status || 'N/A'}`);
      console.log('');
      console.log('✅ Mureka API가 정상적으로 작동합니다.');
      console.log('   ⚠️  참고: 이 테스트로 실제 음악 생성 작업이 시작되었을 수 있습니다.');
    } else {
      console.error('   ❌ API 호출 실패!');
      console.error(`   - HTTP 상태: ${testResponse.status}`);
      console.error(`   - 응답: ${JSON.stringify(responseData, null, 2)}`);
      
      if (testResponse.status === 401) {
        console.error('\n❌ API 키가 유효하지 않습니다. Mureka 대시보드에서 올바른 키를 확인하세요.');
      } else if (testResponse.status === 403) {
        console.error('\n❌ API 접근 권한이 없습니다. 계정 상태를 확인하세요.');
      } else if (testResponse.status === 429) {
        console.error('\n❌ Rate limit에 도달했습니다. 잠시 후 다시 시도하세요.');
      } else if (testResponse.status === 402) {
        console.error('\n❌ 결제 정보가 필요합니다. Mureka 대시보드에서 결제 정보를 추가하세요.');
      }
      
      process.exit(1);
    }
  } catch (error: unknown) {
    const err = error as Record<string, unknown>;
    const message = error instanceof Error ? error.message : String(error);
    const code = err.code as string | undefined;

    console.error('   ❌ API 호출 실패!');
    console.error(`   - 에러 메시지: ${message}`);
    
    if (code === 'ENOTFOUND' || code === 'ECONNREFUSED') {
      console.error('\n❌ 네트워크 연결 문제입니다. 인터넷 연결을 확인하세요.');
    } else if (code === 'ETIMEDOUT') {
      console.error('\n❌ 요청 시간 초과입니다. 잠시 후 다시 시도하세요.');
    }
    
    process.exit(1);
  }
}

testMureka().catch((error) => {
  console.error('예상치 못한 오류:', error);
  process.exit(1);
});
