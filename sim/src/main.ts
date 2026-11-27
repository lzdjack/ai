// pnpm dev 启动的模拟服务进程。端口和数据目录读 ~/.cloudcraft-dev/.env（只取这两项，不碰其他密钥）。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { buildSim } from './server.ts';

const dataDir = process.env.CC_DATA_DIR || path.join(os.homedir(), '.cloudcraft-dev');
const envFile = path.join(dataDir, '.env');
const fileEnv = fs.existsSync(envFile) ? parseEnv(fs.readFileSync(envFile, 'utf8')) : {};
const port = Number(process.env.CC_SIM_PORT || fileEnv.CC_SIM_PORT || 4200);
const envPort = Number(process.env.CC_SIM_ENV_PORT || fileEnv.CC_SIM_ENV_PORT || 4201);

const app = await buildSim({ dataDir, logger: true });
await app.listen({ host: '127.0.0.1', port });
const envUrl = await app.envSites.listen('test', envPort);
console.log(
  `模拟服务  http://127.0.0.1:${port}/   （控制台；GitLab 接口 /api/v4，git 克隆 /<组>/<项目>.git）`,
);
console.log(`测试环境  ${envUrl}   （demo-web 部署在这里）`);
