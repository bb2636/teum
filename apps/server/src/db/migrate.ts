import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env file if it exists
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
  // .env file doesn't exist, try dotenv.config()
  dotenv.config();
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set. Please create .env file with DATABASE_URL');
  process.exit(1);
}

const client = postgres(connectionString, { max: 1 });

async function runMigrations() {
  try {
    console.log('Running migrations...');
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('Migrations completed successfully!');
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    await client.end();
    process.exit(1);
  }
}

runMigrations();
