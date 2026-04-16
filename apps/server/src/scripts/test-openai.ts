/**
 * OpenAI API 연결 테스트 스크립트
 * 
 * 사용법: pnpm --filter server test:openai
 */

import { OpenAI } from 'openai';
import * as dotenv from 'dotenv';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// .env 파일 로드
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../../.env');
dotenv.config({ path: envPath });

async function testOpenAI() {
  console.log('=== OpenAI API 연결 테스트 ===\n');

  // 1. 환경 변수 확인
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL_TEXT || 'gpt-4o-mini';
  const encouragementEnabled = process.env.AI_ENCOURAGEMENT_ENABLED === 'true';

  console.log('1. 환경 변수 확인:');
  console.log(`   - OPENAI_API_KEY: ${apiKey ? `${apiKey.substring(0, 7)}...` : '❌ 없음'}`);
  console.log(`   - OPENAI_MODEL_TEXT: ${model}`);
  console.log(`   - AI_ENCOURAGEMENT_ENABLED: ${encouragementEnabled ? '✅ true' : '❌ false'}`);
  console.log('');

  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY가 설정되지 않았습니다.');
    console.error('   .env 파일에 OPENAI_API_KEY=sk-... 를 추가하세요.');
    process.exit(1);
  }

  if (!encouragementEnabled) {
    console.warn('⚠️  AI_ENCOURAGEMENT_ENABLED가 false입니다.');
    console.warn('   .env 파일에 AI_ENCOURAGEMENT_ENABLED=true 를 추가하세요.');
  }

  // 2. OpenAI 클라이언트 초기화
  console.log('2. OpenAI 클라이언트 초기화 중...');
  const client = new OpenAI({ apiKey });
  console.log('   ✅ 클라이언트 생성 완료\n');

  // 3. 간단한 테스트 요청
  console.log('3. API 호출 테스트 중...');
  try {
    const response = await client.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content: '당신은 따뜻하고 공감적인 일기 응원 메시지를 작성하는 도우미입니다.',
        },
        {
          role: 'user',
          content: '오늘은 좋은 하루였습니다.',
        },
      ],
      temperature: 0.9,
      max_tokens: 200,
    });

    console.log('   ✅ API 호출 성공!');
    console.log(`   - 응답: ${response.choices[0]?.message?.content || '없음'}`);
    console.log(`   - 사용된 토큰: ${response.usage?.total_tokens || 'N/A'}`);
    console.log('');
    console.log('✅ 모든 테스트 통과! OpenAI API가 정상적으로 작동합니다.');
  } catch (error: unknown) {
    const err = error as Record<string, unknown>;
    const message = error instanceof Error ? error.message : String(error);
    const code = err.code as string | undefined;
    const status = err.status as number | undefined;
    const response = err.response as { data?: unknown } | undefined;

    console.error('   ❌ API 호출 실패!');
    console.error(`   - 에러 메시지: ${message}`);
    console.error(`   - 에러 코드: ${code || 'N/A'}`);
    console.error(`   - HTTP 상태: ${status || 'N/A'}`);
    
    if (response) {
      console.error(`   - 응답 데이터: ${JSON.stringify(response.data, null, 2)}`);
    }

    if (code === 'invalid_api_key') {
      console.error('\n❌ API 키가 유효하지 않습니다. OpenAI 대시보드에서 올바른 키를 확인하세요.');
    } else if (code === 'insufficient_quota') {
      console.error('\n❌ API 사용량 한도를 초과했습니다. OpenAI 대시보드에서 결제 정보를 확인하세요.');
    } else if (status === 429) {
      console.error('\n❌ Rate limit에 도달했습니다. 잠시 후 다시 시도하세요.');
    }

    process.exit(1);
  }
}

testOpenAI().catch((error) => {
  console.error('예상치 못한 오류:', error);
  process.exit(1);
});
