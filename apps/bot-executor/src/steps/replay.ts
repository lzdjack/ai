// Host replay verdict (docs/06 §5.7): the repro tests the bot delivered must fail on the base commit
// and pass on the fix, then the changed repos' typecheck and tests must pass, all in a
// --network=none container. The repro files and the test config are fingerprinted (sha256) at this
// first replay so later rounds can tell when the bot touched them. Only a passing replay pushes the
// fix/ branch (checks before push).
import crypto from 'node:crypto';
import path from 'node:path';
import type { RepoSpec } from '@cloudcraft/core-protocol';
import type { StepHandler, StepResult } from '../runner/loop.ts';
import { runContainer } from '../sandbox/docker.ts';
import { git } from './git.ts';
import { isTestConfig, type Workspaces } from './workspace.ts';

export interface ReplayOptions {
  image: string;
  workspaces: Workspaces;
  gitToken?: string;
  labels?: Record<string, string>;
}

const sh = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
const TAIL = 1500;

export function replayStep(o: ReplayOptions): StepHandler {
  return async (step, signal): Promise<StepResult> => {
    const ws = o.workspaces.get(step);
    const fail = (error: string, output: Record<string, unknown> = {}): StepResult => ({
      outcome: 'failed',
      output,
      error,
    });
    // the delivery lives in the workspace the AI node left on this executor
    if (!ws?.state.delivery || !ws.state.changes) return fail('workspace_lost: no delivery here');
    const { delivery, changes } = ws.state;
    const spec = new Map<string, RepoSpec>(ws.repos.map((r) => [r.name, r]));

    const repro = new Map<string, string[]>();
    for (const p of delivery.repro_tests) {
      const [repo, ...rest] = p.split('/');
      repro.set(repo!, [...(repro.get(repo!) ?? []), rest.join('/')]);
    }
    const missing = [...repro.keys()].filter((r) => !spec.get(r)?.test_command);
    if (missing.length) return fail(`no test command for ${missing.join(', ')}`);

    // fingerprints of what decides the verdict, taken from the fix commit
    const digests: Record<string, string> = {};
    for (const c of changes) {
      const dir = path.join(ws.workDir, c.repo);
      const tracked = (await git(dir, ['ls-tree', '-r', '--name-only', c.head_sha])).split('\n');
      const files = [...(repro.get(c.repo) ?? []), ...tracked.filter(isTestConfig)];
      for (const f of files) {
        const blob = await git(dir, ['show', `${c.head_sha}:${f}`]).catch(() => null);
        if (blob !== null)
          digests[`${c.repo}/${f}`] = crypto.createHash('sha256').update(blob).digest('hex');
      }
    }

    const run = (tag: string, repo: string, cmd: string) =>
      `(cd /work/${repo} && ${cmd} >/tmp/${tag}.log 2>&1); echo "RESULT ${tag} $?"; ` +
      `grep -q AssertionError /tmp/${tag}.log && echo "ASSERT ${tag}"; ` +
      `tail -c ${TAIL} /tmp/${tag}.log | sed 's/^/LOG ${tag} /'`;
    const reproRuns = (when: string) =>
      [...repro].map(([repo, files]) =>
        run(
          `${when}-repro-${repo}`,
          repo,
          `${spec.get(repo)!.test_command} ${files.map(sh).join(' ')}`,
        ),
      );
    const script = [
      `git config --global --add safe.directory '*'`,
      // base: the code before the fix, with only the bot's repro tests taken from the fix
      ...changes.map(
        (c) =>
          `cd /work/${c.repo} && git checkout -q --detach ${c.base_sha} && ${
            repro.has(c.repo)
              ? `git checkout -q ${c.head_sha} -- ${repro.get(c.repo)!.map(sh).join(' ')}`
              : 'true'
          }`,
      ),
      ...reproRuns('base'),
      // head: the fix
      ...changes.map((c) => `cd /work/${c.repo} && git checkout -q -f ${c.head_sha}`),
      ...reproRuns('head'),
      ...changes.flatMap((c) => {
        const r = spec.get(c.repo)!;
        return [
          ...(r.typecheck_command
            ? [run(`head-typecheck-${c.repo}`, c.repo, r.typecheck_command)]
            : []),
          ...(r.test_command ? [run(`head-tests-${c.repo}`, c.repo, r.test_command)] : []),
        ];
      }),
      // leave the work tree on the branch again
      ...changes.map((c) => `cd /work/${c.repo} && git checkout -q -f ${ws.state.branch}`),
    ].join('\n');
    const r = await runContainer({
      image: o.image,
      network: 'none',
      mounts: ws.state.mounts,
      script,
      signal,
      labels: o.labels,
    });

    const results: Record<string, number> = {};
    const asserted: string[] = [];
    const logs: Record<string, string> = {};
    for (const l of r.output.split('\n')) {
      const m = /^RESULT (\S+) (\d+)$/.exec(l);
      if (m) results[m[1]!] = Number(m[2]);
      const a = /^ASSERT (\S+)$/.exec(l);
      if (a) asserted.push(a[1]!);
      const g = /^LOG (\S+) (.*)$/.exec(l);
      if (g) logs[g[1]!] = `${logs[g[1]!] ?? ''}${g[2]}\n`;
    }
    const fails = (k: string) => k in results && results[k] !== 0;
    const passes = (k: string) => results[k] === 0;
    const repos = [...repro.keys()];
    const verdict = {
      repro_fails_before: repos.length > 0 && repos.every((x) => fails(`base-repro-${x}`)),
      repro_passes_after: repos.length > 0 && repos.every((x) => passes(`head-repro-${x}`)),
      typecheck: changes.every(
        (c) => !spec.get(c.repo)!.typecheck_command || passes(`head-typecheck-${c.repo}`),
      ),
      tests: changes.every(
        (c) => !spec.get(c.repo)!.test_command || passes(`head-tests-${c.repo}`),
      ),
    };
    const ok = r.exitCode !== null && Object.values(verdict).every(Boolean);
    const output: Record<string, unknown> = {
      network: 'none',
      verdict,
      results,
      // a repro that fails before the fix only because it does not compile proves little
      repro_failed_on_assertion: repos.filter((x) => asserted.includes(`base-repro-${x}`)),
      digests,
      ms: r.ms,
    };
    if (!ok) {
      const bad = Object.keys(results).filter((k) =>
        k.startsWith('base-') ? !fails(k) : !passes(k),
      );
      return fail(`replay failed: ${bad.join(', ') || 'container error'}`, {
        ...output,
        logs: Object.fromEntries(bad.map((k) => [k, logs[k]?.slice(-TAIL) ?? ''])),
      });
    }

    const pushed = [];
    for (const c of changes) {
      const dir = path.join(ws.workDir, c.repo);
      await git(dir, ['push', '-q', 'origin', `${c.head_sha}:refs/heads/${ws.state.branch}`], {
        token: o.gitToken,
        signal,
      });
      pushed.push({ repo: c.repo, branch: ws.state.branch, head_sha: c.head_sha });
    }
    return { outcome: 'done', output: { ...output, pushed } };
  };
}
