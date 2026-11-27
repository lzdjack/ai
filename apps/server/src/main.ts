// pnpm dev 启动的接口服务进程（cc-app）。数据库用运行账号 cc_app 连接，不能绕过 RLS。
import { databaseUrls, loadConfig } from '@cloudcraft/config';
import { buildApp } from './app.ts';
import { createDb } from './db/client.ts';

const c = loadConfig();
const db = createDb(databaseUrls(c).app);
const app = buildApp({ db, logger: true });
await app.listen({ host: '127.0.0.1', port: c.CC_APP_PORT });
