// Integration-test databases (docs/07 §7.1): one migrated template per migration content, and a fresh
// clone of it for every test file. Needs the local PostgreSQL from `pnpm dev:up`.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '@cloudcraft/config';
import pg from 'pg';
import { FUNCTIONS_SQL, MIGRATIONS_DIR, SECURITY_SQL, migrateDatabase } from '../src/db/migrate.ts';

const c = loadConfig();
const url = (user: string, password: string, db: string) =>
  `postgres://${user}:${encodeURIComponent(password)}@${c.CC_PG_HOST}:${c.CC_PG_PORT}/${db}`;

export interface TestDb {
  name: string;
  appUrl: string;
  migratorUrl: string;
  /** superuser: only for fixtures that must bypass RLS (e.g. rows in another workspace) */
  superUrl: string;
  drop(): Promise<void>;
}

function templateName(): string {
  const h = crypto.createHash('sha256');
  const files = [
    ...fs
      .readdirSync(MIGRATIONS_DIR, { recursive: true, encoding: 'utf8' })
      .map((f) => path.join(MIGRATIONS_DIR, f)),
    FUNCTIONS_SQL,
    SECURITY_SQL,
  ].sort();
  for (const f of files) if (fs.statSync(f).isFile()) h.update(f).update(fs.readFileSync(f));
  return `cc_tpl_${h.digest('hex').slice(0, 12)}`;
}

async function superClient(db = 'postgres'): Promise<pg.Client> {
  const client = new pg.Client({
    connectionString: url('postgres', c.CC_PG_SUPERUSER_PASSWORD, db),
  });
  try {
    await client.connect();
  } catch (e) {
    throw new Error('local PostgreSQL is not reachable; run `pnpm dev:up` first', { cause: e });
  }
  return client;
}

async function ensureTemplate(admin: pg.Client, tpl: string): Promise<void> {
  await admin.query('select pg_advisory_lock(73420001)');
  try {
    const exists = await admin.query('select 1 from pg_database where datname = $1', [tpl]);
    if (exists.rowCount) return;
    await admin.query(`create database ${tpl} owner cc_migrator`);
    const t = await superClient(tpl);
    try {
      // what infra/postgres/init/01-roles.sh does for the main database
      await t.query(`create extension if not exists pg_bigm;
        alter schema public owner to cc_migrator;
        revoke all on schema public from public;
        grant usage on schema public to cc_app;`);
    } finally {
      await t.end();
    }
    await migrateDatabase(url('cc_migrator', c.CC_PG_MIGRATOR_PASSWORD, tpl));
    // templates from older migration content are no longer needed
    const stale = await admin.query<{ datname: string }>(
      `select datname from pg_database where datname like 'cc\\_tpl\\_%' and datname <> $1`,
      [tpl],
    );
    for (const { datname } of stale.rows)
      await admin.query(`drop database if exists ${datname}`).catch(() => {});
  } finally {
    await admin.query('select pg_advisory_unlock(73420001)');
  }
}

export async function createTestDb(): Promise<TestDb> {
  const admin = await superClient();
  const tpl = templateName();
  const name = `cc_test_${crypto.randomBytes(5).toString('hex')}`;
  try {
    await ensureTemplate(admin, tpl);
    await admin.query(`create database ${name} template ${tpl} owner cc_migrator`);
  } finally {
    await admin.end();
  }
  return {
    name,
    appUrl: url('cc_app', c.CC_PG_APP_PASSWORD, name),
    migratorUrl: url('cc_migrator', c.CC_PG_MIGRATOR_PASSWORD, name),
    superUrl: url('postgres', c.CC_PG_SUPERUSER_PASSWORD, name),
    async drop() {
      const a = await superClient();
      try {
        await a.query(`drop database if exists ${name} with (force)`);
      } finally {
        await a.end();
      }
    },
  };
}
