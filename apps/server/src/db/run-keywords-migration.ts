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

const FILES = [
  '0014_music_jobs_keywords_jsonb.sql',
  '0015_music_jobs_source_diary_ids_jsonb.sql',
];

async function run() {
  for (const file of FILES) {
    const path = join(process.cwd(), 'drizzle', file);
    try {
      console.log(`Running ${file}...`);
      const sql = readFileSync(path, 'utf-8');
      await client.unsafe(sql);
      console.log(`  Done: ${file}`);
    } catch (e: unknown) {
      if (String(e).includes('does not exist') || String(e).includes('already exists')) {
        console.log(`  Skipped (already applied or not needed): ${file}`);
      } else {
        throw e;
      }
    }
  }
  await client.end();
  console.log('Done.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  client.end().catch(() => {});
  process.exit(1);
});
