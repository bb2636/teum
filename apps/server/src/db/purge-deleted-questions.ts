/**
 * soft-deleted 질문들을 DB에서 완전 삭제
 * 한 번만 실행: pnpm exec tsx src/db/purge-deleted-questions.ts
 */
import { sqlClient } from './index';

async function main() {
  const result = await sqlClient`
    DELETE FROM questions WHERE deleted_at IS NOT NULL
    RETURNING id
  `;
  console.log(`Purged ${result.length} soft-deleted question(s)`);
  await sqlClient.end();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
