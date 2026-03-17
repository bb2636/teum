/**
 * order → sort_order 마이그레이션 수동 실행
 * Drizzle journal에 등록되지 않은 0012, 0013을 직접 실행합니다.
 */
import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env
try {
  const envPath = join(process.cwd(), '.env');
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim();
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value.replace(/^["']|["']$/g, '');
      }
    }
  });
} catch {
  // .env 없으면 스킵
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const client = postgres(connectionString, { max: 1 });

const FILES = ['0012_questions_sort_order.sql', '0013_diary_order_to_sort_order.sql'];

async function run() {
  for (const file of FILES) {
    const path = join(process.cwd(), 'drizzle', file);
    console.log(`Running ${file}...`);
    const sql = readFileSync(path, 'utf-8');
    await client.unsafe(sql);
    console.log(`  Done: ${file}`);
  }
  await client.end();
  console.log('All migrations completed.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  client.end().catch(() => {});
  process.exit(1);
});
