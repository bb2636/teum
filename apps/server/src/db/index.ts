import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

// postgres-js connection pool (raw 쿼리용으로 export)
export const sqlClient = postgres(connectionString, {
  max: 10,
});

// Drizzle instance
export const db = drizzle(sqlClient, { schema });

// Export schema for use in other files
export * from './schema';
