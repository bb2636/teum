import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env file
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
} catch (error) {
  dotenv.config();
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const client = postgres(connectionString, { max: 1 });

async function runSQLMigration() {
  try {
    const sql = readFileSync(join(process.cwd(), 'drizzle', '0007_add_user_is_active.sql'), 'utf-8');
    
    console.log('Running SQL migration...');
    await client.unsafe(sql);
    console.log('Migration completed successfully!');
    
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    await client.end();
    process.exit(1);
  }
}

runSQLMigration();
