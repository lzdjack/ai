// 模拟 GitLab 场景测试（E0-3 验收）：真 git 克隆推送、受保护分支、建 MR 合并、冲突、Webhook、故障注入。
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildSim } from './index.ts';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-sim-'));
let app: Awaited<ReturnType<typeof buildSim>>;
let base = '';
let tokens: Record<string, string> = {};
const hookEvents: Array<{ event: string; body: { object_attributes?: { action: string } } }> = [];
const hookServer = http.createServer((req, res) => {
  let data = '';
  req.on('data', (c) => (data += c));
  req.on('end', () => {
    hookEvents.push({ event: String(req.headers['x-gitlab-event']), body: JSON.parse(data) });
    res.end();
  });
});

/** 隔离本机 git 配置和凭据助手；凭据用请求头传，不进 URL */
function git(
  cwd: string,
  token: string | null,
  ...args: string[]
): Promise<{ ok: boolean; out: string }> {
  const auth = token
    ? [
        '-c',
        `http.extraHeader=Authorization: Basic ${Buffer.from(`x:${token}`).toString('base64')}`,
      ]
    : [];
  return new Promise((resolve) => {
    execFile(
      'git',
      [
        '-c',
        'user.name=测试',
        '-c',
        'user.email=t@sim.local',
        '-c',
        'credential.helper=',
        ...auth,
        ...args,
      ],
      {
        cwd,
        env: {
          PATH: process.env.PATH,
          HOME: tmp,
          GIT_CONFIG_NOSYSTEM: '1',
          GIT_CONFIG_GLOBAL: '/dev/null',
          GIT_TERMINAL_PROMPT: '0',
        },
      },
      (err, stdout, stderr) => resolve({ ok: !err, out: `${stdout}${stderr}` }),
    );
  });
}

async function commitFile(dir: string, file: string, content: string, msg: string) {
  fs.writeFileSync(path.join(dir, file), content);
  expect((await git(dir, null, 'add', '.')).ok).toBe(true);
  expect((await git(dir, null, 'commit', '-qm', msg)).ok).toBe(true);
}

async function api(method: string, url: string, token: string | null, body?: object) {
  const res = await fetch(`${base}${url}`, {
    method,
    headers: {
      ...(token ? { 'PRIVATE-TOKEN': token } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
}

beforeAll(async () => {
  app = await buildSim({ dataDir: tmp });
  await app.listen({ host: '127.0.0.1', port: 0 });
  base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  const users = (await api('GET', '/__sim/gitlab/users', null)).body as Array<{
    username: string;
    token: string;
  }>;
  tokens = Object.fromEntries(users.map((u) => [u.username, u.token]));
  await new Promise<void>((r) => hookServer.listen(0, '127.0.0.1', r));
});

afterAll(async () => {
  await app.close();
  hookServer.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

// 每个用例要跑十几次真实 git，默认 5 秒不够
describe('模拟 GitLab', { timeout: 30_000 }, () => {
  it('克隆推送、受保护分支、MR 合并与冲突、Webhook', async () => {
    const bot = tokens['cc-bot']!;
    const reviewer = tokens['qa-reviewer']!;
    const created = await api('POST', '/__sim/gitlab/projects', null, {
      path_with_namespace: 'demo/web-app',
    });
    expect(created.status).toBe(201);
    const pid = encodeURIComponent('demo/web-app');
    const repoUrl = `${base}/demo/web-app.git`;
    const hookUrl = `http://127.0.0.1:${(hookServer.address() as AddressInfo).port}/`;
    const hook = await api('POST', `/api/v4/projects/${pid}/hooks`, reviewer, {
      url: hookUrl,
      push_events: true,
      merge_requests_events: true,
      token: 'hook-secret',
    });
    expect(hook.status).toBe(201);

    // 维护者推初始 main；无令牌、Bot 推 main 都被拒
    const seed = path.join(tmp, 'seed');
    fs.mkdirSync(seed);
    await git(seed, null, 'init', '-q', '-b', 'main');
    await commitFile(seed, 'app.txt', 'line1\nline2\n', 'init');
    await git(seed, null, 'remote', 'add', 'origin', repoUrl);
    expect((await git(seed, null, 'push', '-q', 'origin', 'main')).ok).toBe(false);
    expect((await git(seed, bot, 'push', '-q', 'origin', 'main')).out).toContain(
      'protected branches',
    );
    expect((await git(seed, reviewer, 'push', '-q', 'origin', 'main')).ok).toBe(true);

    // Bot 克隆，推 fix/* 可以，推其他名字不行
    const work = path.join(tmp, 'work');
    expect((await git(tmp, bot, 'clone', '-q', repoUrl, work)).ok).toBe(true);
    await git(work, null, 'switch', '-qc', 'fix/a');
    await commitFile(work, 'app.txt', 'line1 fixed\nline2\n', 'fix a');
    expect((await git(work, bot, 'push', '-q', 'origin', 'fix/a')).ok).toBe(true);
    await git(work, null, 'switch', '-qc', 'feature/x');
    expect((await git(work, bot, 'push', '-q', 'origin', 'feature/x')).out).toContain(
      'does not follow',
    );

    // 另一条修改同一行的分支，用来造冲突
    await git(work, null, 'switch', '-qc', 'fix/b', 'main');
    await commitFile(work, 'app.txt', 'line1 other\nline2\n', 'fix b');
    expect((await git(work, bot, 'push', '-q', 'origin', 'fix/b')).ok).toBe(true);

    // 建 MR → 可合并；Bot 无权合入受保护分支；审核人合并成功
    const mr = await api('POST', `/api/v4/projects/${pid}/merge_requests`, bot, {
      source_branch: 'fix/a',
      target_branch: 'main',
      title: '修复 A',
    });
    expect(mr.status).toBe(201);
    expect(mr.body.detailed_merge_status).toBe('mergeable');
    const changes = await api('GET', `/api/v4/projects/${pid}/merge_requests/1/changes`, bot);
    expect(changes.body.changes[0].diff).toContain('+line1 fixed');
    expect((await api('PUT', `/api/v4/projects/${pid}/merge_requests/1/merge`, bot)).status).toBe(
      401,
    );
    const stale = await api('PUT', `/api/v4/projects/${pid}/merge_requests/1/merge`, reviewer, {
      sha: '0'.repeat(40),
    });
    expect(stale.status).toBe(409);
    const merged = await api('PUT', `/api/v4/projects/${pid}/merge_requests/1/merge`, reviewer, {
      sha: mr.body.sha,
    });
    expect(merged.status).toBe(200);
    expect(merged.body.state).toBe('merged');
    expect((await git(work, bot, 'ls-remote', 'origin', 'refs/heads/main')).out).toContain(
      merged.body.merge_commit_sha,
    );

    // fix/b 现在和 main 冲突
    const mr2 = await api('POST', `/api/v4/projects/${pid}/merge_requests`, bot, {
      source_branch: 'fix/b',
      target_branch: 'main',
      title: '修复 B',
    });
    expect(mr2.body.detailed_merge_status).toBe('conflict');
    expect(
      (await api('PUT', `/api/v4/projects/${pid}/merge_requests/2/merge`, reviewer)).status,
    ).toBe(406);

    // 查询接口
    const branches = await api('GET', `/api/v4/projects/${pid}/repository/branches`, bot);
    expect(branches.body.map((b: { name: string }) => b.name).sort()).toEqual([
      'fix/a',
      'fix/b',
      'main',
    ]);
    expect(branches.headers.get('x-total')).toBe('3');
    const raw = await fetch(
      `${base}/api/v4/projects/${pid}/repository/files/app.txt/raw?ref=main`,
      {
        headers: { 'PRIVATE-TOKEN': bot },
      },
    );
    expect(await raw.text()).toBe('line1 fixed\nline2\n');

    // Webhook：推送、MR 建立与合并都投递了，带令牌头
    await expect.poll(() => hookEvents.length).toBeGreaterThanOrEqual(6);
    const actions = hookEvents.map((e) => e.body.object_attributes?.action ?? e.event);
    expect(actions).toEqual(expect.arrayContaining(['Push Hook', 'open', 'merge']));
  });

  it('故障注入：429 带 Retry-After、401、合并冲突，用完次数自动恢复', async () => {
    const bot = tokens['cc-bot']!;
    expect((await api('GET', '/api/v4/user', 'wrong-token')).status).toBe(401);

    await api('POST', '/__sim/faults', null, {
      module: 'gitlab',
      kind: 'rate_limit',
      times: 1,
      retry_after_s: 7,
    });
    const limited = await api('GET', '/api/v4/user', bot);
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe('7');
    expect((await api('GET', '/api/v4/user', bot)).body.username).toBe('cc-bot');

    // 只对 git 克隆路径生效的 401
    await api('POST', '/__sim/faults', null, {
      module: 'gitlab',
      kind: 'unauthorized',
      path: '.git/',
      times: 1,
    });
    expect(
      (await git(tmp, bot, 'clone', '-q', `${base}/demo/web-app.git`, path.join(tmp, 'c2'))).ok,
    ).toBe(false);
    expect(
      (await git(tmp, bot, 'clone', '-q', `${base}/demo/web-app.git`, path.join(tmp, 'c3'))).ok,
    ).toBe(true);

    // 强制合并冲突：本来可合并的 MR 合并时返回 406
    const work = path.join(tmp, 'c3');
    await git(work, null, 'switch', '-qc', 'fix/c');
    await commitFile(work, 'new.txt', 'x\n', 'fix c');
    await git(work, bot, 'push', '-q', 'origin', 'fix/c');
    const pid = encodeURIComponent('demo/web-app');
    const mr = await api('POST', `/api/v4/projects/${pid}/merge_requests`, bot, {
      source_branch: 'fix/c',
      target_branch: 'main',
      title: '修复 C',
    });
    await api('POST', '/__sim/faults', null, {
      module: 'gitlab',
      kind: 'merge_conflict',
      times: 1,
    });
    const url = `/api/v4/projects/${pid}/merge_requests/${mr.body.iid}/merge`;
    expect((await api('PUT', url, tokens['qa-reviewer']!)).status).toBe(406);
    expect((await api('PUT', url, tokens['qa-reviewer']!)).status).toBe(200);
    expect((await api('GET', '/__sim/faults', null)).body).toEqual([]);
  });
});
