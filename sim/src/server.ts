// 模拟服务入口（07 §5）：一个 Fastify 进程，按模块注册。不依赖任何产品代码（07 §2.3）。
import fs from 'node:fs';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { ApolloSim } from './apollo/index.ts';
import { EnvSites, type LiveRelease } from './envsite/index.ts';
import { Faults } from './faults.ts';
import { GitlabSim } from './gitlab/index.ts';
import { OssSim } from './oss/index.ts';
import { StateStore } from './state.ts';

export interface SimOptions {
  /** 运行时数据目录（~/.cloudcraft-dev）；裸仓放 git/，状态放 sim/ */
  dataDir: string;
  logger?: boolean;
}

declare module 'fastify' {
  interface FastifyInstance {
    /** 环境站点（envsite/）；端口由调用方 listen */
    envSites: EnvSites;
  }
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

  const apollo = new ApolloSim(store, faults);
  apollo.seedUsers();
  const oss = new OssSim(path.join(opts.dataDir, 'sim', 'oss'));

  const envs = new EnvSites(path.join(opts.dataDir, 'sim', 'envs'), (name) =>
    liveRelease(apollo, oss, name),
  );
  app.decorate('envSites', envs);

  faults.register(app);
  gitlab.register(app);
  apollo.register(app);
  oss.register(app);
  envs.register(app);

  // 控制台（07 §5.3）：给质检看状态、开关故障
  const page = fs.readFileSync(path.join(import.meta.dirname, 'console.html'), 'utf8');
  app.get('/', async (_req, reply) => reply.type('text/html; charset=utf-8').send(page));
  app.get('/__sim/state', async () => ({
    gitlab: { ...store.data.gitlab, deliveries: gitlab.deliveries },
    faults: faults.all(),
    envs: envs.state(),
    apollo: { releases: (store.data.apollo?.releases ?? []).slice(-20) },
  }));

  return app;
}

/**
 * 环境站点和模拟 Apollo 的对应关系（demo-web 一个应用）：环境 test → Apollo TEST，prod → PRO；
 * 应用 demo-web、集群 default、命名空间 application、配置项 demo-web。
 * 假设：配置项的值按 tita release 写的内容简化成 JSON——Version（版本号）、CommitId（提交号）、
 * Bucket / Prefix（产物在 OSS 里的位置）；真实的是 tita 生成的带 <CommitId> 的配置（04 §3）。
 */
export const DEMO_APOLLO = {
  app: 'demo-web',
  cluster: 'default',
  namespace: 'application',
  key: 'demo-web',
  envs: { test: 'TEST', prod: 'PRO' } as Record<string, string>,
};

function liveRelease(apollo: ApolloSim, oss: OssSim, name: string): LiveRelease | null {
  const env = DEMO_APOLLO.envs[name];
  if (!env) return null;
  const r = apollo.active(DEMO_APOLLO.app, env, DEMO_APOLLO.cluster, DEMO_APOLLO.namespace);
  const raw = r?.configurations[DEMO_APOLLO.key];
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as {
      Version: string;
      CommitId: string;
      Bucket: string;
      Prefix: string;
    };
    return {
      version: v.Version,
      commit: v.CommitId,
      read: (rel) => oss.read(v.Bucket, `${v.Prefix.replace(/\/?$/, '/')}${rel}`),
    };
  } catch {
    return null;
  }
}
