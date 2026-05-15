import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const migrationsFolder = path.join(process.cwd(), 'drizzle');
const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));

const sql = postgres(connectionString, { max: 1 });

async function run() {
  try {
    await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
    await sql`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `;

    const existing = await sql`SELECT hash FROM drizzle.__drizzle_migrations`;
    const existingHashes = new Set(existing.map((r: any) => r.hash));

    let inserted = 0;
    let skipped = 0;
    for (const entry of journal.entries) {
      const sqlPath = path.join(migrationsFolder, `${entry.tag}.sql`);
      const content = fs.readFileSync(sqlPath, 'utf-8');
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      if (existingHashes.has(hash)) {
        console.log(`SKIP  ${entry.tag} (already recorded)`);
        skipped++;
        continue;
      }
      await sql`
        INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
        VALUES (${hash}, ${entry.when})
      `;
      console.log(`OK    ${entry.tag}`);
      inserted++;
    }

    console.log(`\nDone. Inserted: ${inserted}, Skipped: ${skipped}`);
    await sql.end();
    process.exit(0);
  } catch (e) {
    console.error('Failed:', e);
    await sql.end();
    process.exit(1);
  }
}

run();
