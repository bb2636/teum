import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

// postgres-js connection pool
const client = postgres(connectionString, {
  max: 10,
});

// Drizzle instance
export const db = drizzle(client, { schema });

// Export schema for use in other files
export * from './schema';
