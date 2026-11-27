// 模拟服务入口（07 §5）：一个 Fastify 进程，按模块注册。不依赖任何产品代码（07 §2.3）。
import fs from 'node:fs';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { Faults } from './faults.ts';
import { GitlabSim } from './gitlab/index.ts';
import { StateStore } from './state.ts';

export interface SimOptions {
  /** 运行时数据目录（~/.cloudcraft-dev）；裸仓放 git/，状态放 sim/ */
  dataDir: string;
  logger?: boolean;
}

export async function buildSim(opts: SimOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ? { level: 'warn' } : false,
    // GitLab 的参数校验报错格式：{ error: "<字段> is missing" }
    schemaErrorFormatter: (errors) => new Error(errors.map((e) => e.message).join('; ')),
  });
  app.setErrorHandler(
    (err: { validation?: unknown; statusCode?: number; message: string }, _req, reply) => {
      if (err.validation) return reply.code(400).send({ error: err.message });
      return reply.code(err.statusCode ?? 500).send({ message: err.message });
    },
  );

  const store = new StateStore(path.join(opts.dataDir, 'sim'));
  const faults = new Faults();
  const gitlab = new GitlabSim(store, path.join(opts.dataDir, 'git'), faults);
  gitlab.seedUsers();

  faults.register(app);
  gitlab.register(app);

  // 控制台（07 §5.3）：给质检看状态、开关故障
  const page = fs.readFileSync(path.join(import.meta.dirname, 'console.html'), 'utf8');
  app.get('/', async (_req, reply) => reply.type('text/html; charset=utf-8').send(page));
  app.get('/__sim/state', async () => ({
    gitlab: { ...store.data.gitlab, deliveries: gitlab.deliveries },
    faults: faults.all(),
  }));

  return app;
}
