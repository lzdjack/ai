// pnpm dev:up：起本地基础设施并自检（docs/07 §4.4）。可重复执行。
import { databaseUrls } from '@cloudcraft/config';
import {
  compose,
  dataDir,
  ensureDataDirs,
  ensureEnvFile,
  ensureMasterKey,
  loadConfigOrExit,
  must,
} from './lib.ts';

const dir = dataDir();
ensureDataDirs(dir);
const env = ensureEnvFile(dir);
if (env.created) console.log(`· 已生成 ${dir}/.env（OpenAI 密钥请你自己填 OPENAI_API_KEY）`);
else if (env.added.length) console.log(`· .env 补上了 ${env.added.join('、')}`);
if (ensureMasterKey(dir)) console.log('· 已生成本机凭据信封主密钥 keys/dev-master.key');

const c = loadConfigOrExit();

must('启动 PostgreSQL 与 mailpit', compose(c, ['up', '-d', '--build', '--wait', '--quiet-pull']));
console.log('✓ 容器已就绪');

// 自检：用运行账号经 TCP 密码登录，确认 pg_bigm 可用、运行账号不能绕过 RLS
const sql =
  "select show_bigm('云匠') is not null, (select rolbypassrls from pg_roles where rolname = 'cc_app')";
const check = compose(c, [
  'exec',
  '-T',
  '-e',
  `PGPASSWORD=${c.CC_PG_APP_PASSWORD}`,
  'postgres',
  'psql',
  '-h',
  '127.0.0.1',
  '-U',
  'cc_app',
  '-d',
  c.CC_PG_DATABASE,
  '-tAc',
  sql,
]);
must('数据库自检', check);
if (check.out.trim() !== 't|f')
  must('数据库自检', { ok: false, out: `期望 t|f，实际 ${check.out}` });
console.log('✓ PostgreSQL：运行账号可登录，pg_bigm 可用，不能绕过 RLS');

const mail = await fetch(`http://127.0.0.1:${c.CC_MAILPIT_UI_PORT}/api/v1/info`).catch(() => null);
must('mailpit 自检', { ok: !!mail?.ok, out: `http://127.0.0.1:${c.CC_MAILPIT_UI_PORT} 无响应` });
console.log('✓ mailpit 可用');

const { app } = databaseUrls(c);
console.log(`
数据库    ${app.replace(/:[^:@]+@/, ':***@')}
收件箱    http://127.0.0.1:${c.CC_MAILPIT_UI_PORT}
SMTP      127.0.0.1:${c.CC_SMTP_PORT}
数据目录  ${dir}
- 数据库迁移与种子数据：P1 起
- demo 仓推进模拟 GitLab：E0-4 起`);
