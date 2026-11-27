// Database migration (docs/07 §3.2): drizzle migrations, then the repeatable SQL
// (functions.sql, event partitions, generated security.sql). Runs as cc_migrator.
import fs from 'node:fs';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const SERVER_ROOT = path.resolve(import.meta.dirname, '../..');
export const MIGRATIONS_DIR = path.join(SERVER_ROOT, 'drizzle');
export const FUNCTIONS_SQL = path.join(import.meta.dirname, 'sql', 'functions.sql');
export const SECURITY_SQL = path.join(import.meta.dirname, 'sql', 'security.sql');
/** months of event partitions created ahead */
const PARTITIONS_AHEAD = 3;

export async function migrateDatabase(migratorUrl: string): Promise<void> {
  const client = new pg.Client({ connectionString: migratorUrl });
  await client.connect();
  try {
    await migrate(drizzle({ client, casing: 'snake_case' }), { migrationsFolder: MIGRATIONS_DIR });
    await client.query(fs.readFileSync(FUNCTIONS_SQL, 'utf8'));
    await client.query('select cc_events_ensure_partitions($1)', [PARTITIONS_AHEAD]);
    await client.query(fs.readFileSync(SECURITY_SQL, 'utf8'));
  } finally {
    await client.end();
  }
}
