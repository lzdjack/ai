// 模拟 GitLab 的 git 部分：裸仓、git http-backend、合并、提交与差异读取。全部是真实 git 操作。
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { FastifyReply, FastifyRequest } from 'fastify';

const PRE_RECEIVE = `#!/bin/sh
# 模拟 GitLab 受保护分支与推送规则（环境变量由模拟服务按推送人传入）
set -f  # 分支模式里的 * 不按文件名展开
zero=0000000000000000000000000000000000000000
while read old new ref; do
  branch=\${ref#refs/heads/}
  case ",$CC_SIM_PROTECTED," in *",$branch,"*) protected=1;; *) protected=0;; esac
  if [ "$protected" = 1 ]; then
    if [ "$CC_SIM_ROLE" != maintainer ]; then
      echo "GitLab: You are not allowed to push code to protected branches on this project." >&2; exit 1
    fi
    if [ "$new" = "$zero" ]; then
      echo "GitLab: You can only delete protected branches using the web interface." >&2; exit 1
    fi
    if [ "$old" != "$zero" ] && ! git merge-base --is-ancestor "$old" "$new"; then
      echo "GitLab: You are not allowed to force push code to a protected branch on this project." >&2; exit 1
    fi
    continue
  fi
  if [ -n "$CC_SIM_PUSH_PATTERNS" ]; then
    allowed=0
    for p in $CC_SIM_PUSH_PATTERNS; do
      case "$branch" in $p) allowed=1;; esac
    done
    if [ "$allowed" = 0 ]; then
      echo "GitLab: Branch name does not follow the pattern '$CC_SIM_PUSH_PATTERNS'" >&2; exit 1
    fi
  fi
done
`;

export class GitError extends Error {}

/** macOS 的 /usr/bin/git 是 xcrun 转发壳，每次多 ~80ms；启动时找到真实的 git 可执行文件 */
const GIT = (() => {
  const execPath = spawnSync('git', ['--exec-path'], { encoding: 'utf8' }).stdout?.trim();
  const real = execPath && path.join(execPath, 'git');
  return real && fs.existsSync(real) ? real : 'git';
})();

export class Repo {
  constructor(readonly dir: string) {}

  /** 同步执行 git；失败抛 GitError，allowFail 时返回 null */
  git(args: string[], opts: { env?: NodeJS.ProcessEnv; allowFail?: boolean } = {}): string | null {
    const r = spawnSync(GIT, args, {
      cwd: this.dir,
      encoding: 'utf8',
      env: { ...gitEnv(), ...opts.env },
      maxBuffer: 64 * 1024 * 1024,
    });
    if (r.status === 0) return r.stdout;
    if (opts.allowFail) return null;
    throw new GitError(`git ${args[0]} failed: ${r.stderr.trim()}`);
  }

  static init(dir: string, defaultBranch: string): Repo {
    fs.mkdirSync(dir, { recursive: true });
    const repo = new Repo(dir);
    repo.git(['init', '--bare', '--quiet', `--initial-branch=${defaultBranch}`]);
    repo.git(['config', 'http.receivepack', 'true']);
    repo.git(['config', 'receive.denyNonFastForwards', 'false']);
    const hook = path.join(dir, 'hooks', 'pre-receive');
    fs.writeFileSync(hook, PRE_RECEIVE, { mode: 0o755 });
    return repo;
  }

  branches(): Map<string, string> {
    const out = this.git(['for-each-ref', 'refs/heads', '--format=%(refname:short) %(objectname)']);
    return new Map(
      (out ?? '')
        .split('\n')
        .filter(Boolean)
        .map((l) => l.split(' ') as [string, string]),
    );
  }

  resolve(ref: string): string | null {
    return (
      this.git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], {
        allowFail: true,
      })?.trim() || null
    );
  }

  commits(ref: string, limit: number, skip = 0): Commit[] {
    const out = this.git([
      'log',
      `--max-count=${limit}`,
      `--skip=${skip}`,
      `--format=${LOG_FORMAT}`,
      ref,
    ]);
    return parseLog(out ?? '');
  }

  commit(sha: string): Commit | null {
    const out = this.git(['log', '-1', `--format=${LOG_FORMAT}`, sha], { allowFail: true });
    return out ? (parseLog(out)[0] ?? null) : null;
  }

  /** 两个提交之间的提交（from..to，新的在前） */
  commitsBetween(from: string, to: string): Commit[] {
    return parseLog(this.git(['log', `--format=${LOG_FORMAT}`, `${from}..${to}`]) ?? '');
  }

  /** 两个提交的合并基点；没有共同祖先时 null */
  mergeBase(a: string, b: string): string | null {
    return this.git(['merge-base', a, b], { allowFail: true })?.trim() || null;
  }

  isAncestor(a: string, b: string): boolean {
    return this.git(['merge-base', '--is-ancestor', a, b], { allowFail: true }) !== null;
  }

  /** 差异：straight=false 时和 GitLab 一样从合并基点比（from...to） */
  diff(from: string, to: string, straight = false): DiffEntry[] {
    const range = straight ? [from, to] : [`${from}...${to}`];
    return parseDiff(this.git(['diff', '-M', '--no-color', '--full-index', ...range]) ?? '');
  }

  /** 试合并，不改任何分支：返回合并后的树，冲突返回 null */
  mergeTree(target: string, source: string): string | null {
    const out = this.git(['merge-tree', '--write-tree', target, source], { allowFail: true });
    return out ? (out.split('\n')[0] ?? null) : null;
  }

  /** 生成合并提交并原子更新目标分支（目标分支被别人动过则失败） */
  mergeCommit(opts: {
    tree: string;
    targetBranch: string;
    targetSha: string;
    sourceSha: string;
    message: string;
    author: { name: string; email: string };
  }): string {
    const env = {
      GIT_AUTHOR_NAME: opts.author.name,
      GIT_AUTHOR_EMAIL: opts.author.email,
      GIT_COMMITTER_NAME: opts.author.name,
      GIT_COMMITTER_EMAIL: opts.author.email,
    };
    const sha = (
      this.git(
        ['commit-tree', opts.tree, '-p', opts.targetSha, '-p', opts.sourceSha, '-m', opts.message],
        {
          env,
        },
      ) ?? ''
    ).trim();
    this.git(['update-ref', `refs/heads/${opts.targetBranch}`, sha, opts.targetSha]);
    return sha;
  }

  rawFile(ref: string, file: string): Buffer | null {
    const r = spawnSync(GIT, ['show', `${ref}:${file}`], { cwd: this.dir, env: gitEnv() });
    return r.status === 0 ? r.stdout : null;
  }
}

/** 不读本机用户的 git 配置，保证行为可复现 */
function gitEnv(): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    LANG: 'C',
  };
}

export interface Commit {
  id: string;
  parent_ids: string[];
  author_name: string;
  author_email: string;
  authored_date: string;
  committer_name: string;
  committer_email: string;
  committed_date: string;
  title: string;
  message: string;
}

const LOG_FORMAT = '%H%x00%P%x00%an%x00%ae%x00%aI%x00%cn%x00%ce%x00%cI%x00%s%x00%B%x1e';

function parseLog(out: string): Commit[] {
  return out
    .split('\x1e')
    .map((r) => r.replace(/^\n/, ''))
    .filter(Boolean)
    .map((r) => {
      const [
        id = '',
        parents = '',
        an = '',
        ae = '',
        ad = '',
        cn = '',
        ce = '',
        cd = '',
        s = '',
        b = '',
      ] = r.split('\0');
      return {
        id,
        parent_ids: parents ? parents.split(' ') : [],
        author_name: an,
        author_email: ae,
        authored_date: ad,
        committer_name: cn,
        committer_email: ce,
        committed_date: cd,
        title: s,
        message: b,
      };
    });
}

export interface DiffEntry {
  old_path: string;
  new_path: string;
  a_mode: string;
  b_mode: string;
  new_file: boolean;
  renamed_file: boolean;
  deleted_file: boolean;
  diff: string;
}

/** 把 git diff 输出拆成 GitLab 的 diffs 数组（diff 字段从第一个 @@ 开始） */
function parseDiff(out: string): DiffEntry[] {
  const entries: DiffEntry[] = [];
  for (const chunk of out.split(/^diff --git /m).slice(1)) {
    const lines = chunk.split('\n');
    const head = /^a\/(.+) b\/(.+)$/.exec(lines[0] ?? '');
    const e: DiffEntry = {
      old_path: head?.[1] ?? '',
      new_path: head?.[2] ?? '',
      a_mode: '100644',
      b_mode: '100644',
      new_file: false,
      renamed_file: false,
      deleted_file: false,
      diff: '',
    };
    let i = 1;
    for (; i < lines.length && !lines[i]?.startsWith('@@'); i++) {
      const l = lines[i] ?? '';
      let m: RegExpExecArray | null;
      if ((m = /^new file mode (\d+)/.exec(l)))
        [e.new_file, e.a_mode, e.b_mode] = [true, '0', m[1]!];
      else if ((m = /^deleted file mode (\d+)/.exec(l)))
        [e.deleted_file, e.a_mode, e.b_mode] = [true, m[1]!, '0'];
      else if ((m = /^old mode (\d+)/.exec(l))) e.a_mode = m[1]!;
      else if ((m = /^new mode (\d+)/.exec(l))) e.b_mode = m[1]!;
      else if ((m = /^index \w+\.\.\w+ (\d+)/.exec(l))) e.a_mode = e.b_mode = m[1]!;
      else if ((m = /^rename from (.+)/.exec(l))) [e.renamed_file, e.old_path] = [true, m[1]!];
      else if ((m = /^rename to (.+)/.exec(l))) e.new_path = m[1]!;
    }
    e.diff = lines.slice(i).join('\n');
    entries.push(e);
  }
  return entries;
}

/**
 * 把 git 的 smart HTTP 请求交给 git http-backend（CGI）。
 * hookEnv 会传到 pre-receive 钩子里（推送人角色、受保护分支）。
 */
export function httpBackend(
  req: FastifyRequest,
  reply: FastifyReply,
  opts: { projectRoot: string; pathInfo: string; user: string; hookEnv: Record<string, string> },
): Promise<void> {
  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?') + 1) : '';
  const h = req.headers;
  const child = spawn(GIT, ['http-backend'], {
    env: {
      ...gitEnv(),
      ...opts.hookEnv,
      GIT_PROJECT_ROOT: opts.projectRoot,
      GIT_HTTP_EXPORT_ALL: '1',
      PATH_INFO: opts.pathInfo,
      QUERY_STRING: query,
      REQUEST_METHOD: req.method,
      CONTENT_TYPE: h['content-type'] ?? '',
      ...(h['content-length'] ? { CONTENT_LENGTH: h['content-length'] } : {}),
      ...(h['content-encoding'] ? { HTTP_CONTENT_ENCODING: String(h['content-encoding']) } : {}),
      ...(h['git-protocol'] ? { GIT_PROTOCOL: String(h['git-protocol']) } : {}),
      REMOTE_USER: opts.user,
      REMOTE_ADDR: req.ip,
    },
  });
  reply.hijack();
  req.raw.pipe(child.stdin);

  return new Promise((resolve) => {
    let buf = Buffer.alloc(0);
    let headersSent = false;
    child.stdout.on('data', (chunk: Buffer) => {
      if (headersSent) {
        reply.raw.write(chunk);
        return;
      }
      buf = Buffer.concat([buf, chunk]);
      const end = buf.indexOf('\r\n\r\n');
      if (end < 0) return;
      let status = 200;
      for (const line of buf.subarray(0, end).toString().split('\r\n')) {
        const idx = line.indexOf(':');
        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();
        if (key.toLowerCase() === 'status') status = Number.parseInt(value, 10);
        else reply.raw.setHeader(key, value);
      }
      reply.raw.writeHead(status);
      reply.raw.write(buf.subarray(end + 4));
      headersSent = true;
    });
    child.on('close', () => {
      if (!headersSent) reply.raw.writeHead(500);
      reply.raw.end();
      resolve();
    });
  });
}
