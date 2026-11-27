// Host replay verdict (docs/06 §5.7): the repro tests the bot delivered must fail on the base commit
// and pass on the fix, then the changed repos' typecheck and tests must pass, all in a
// --network=none container. A browser repro (06 §5.2) is replayed on the test environment with the
// repo's base build, then its fix build swapped in: it must stop on an assertion before and pass
// after, with the four replacement invariants holding both times. The repro files and the test config
// are fingerprinted (sha256) at this first replay so later rounds can tell when the bot touched them.
// Only a passing replay pushes the fix/ branch (checks before push).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { BROWSER_IMAGE, runBrowserRepro, type BrowserRunResult } from '@cloudcraft/browser-sandbox';
import {
  invariantsHold,
  type AgentSandbox,
  type BrowserRepro,
  type RepoSpec,
} from '@cloudcraft/core-protocol';
import type { StepHandler, StepResult } from '../runner/loop.ts';
import { ensureImage, runContainer, startContainer } from '../sandbox/docker.ts';
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
    const browser = (delivery as { browser_repro?: BrowserRepro }).browser_repro;
    const target = browser ? spec.get(browser.repo) : undefined;
    const envUrl = (step.config as { env_url?: string }).env_url;
    if (browser) {
      if (
        target?.verify_strategy !== 'browser_dist_replace' ||
        !target.dist_dir ||
        !target.asset_url_patterns?.length
      )
        return fail(`${browser.repo} is not set up for browser verification`);
      if (!envUrl) return fail('browser repro without a test environment (config.env_url)');
    }

    const repro = new Map<string, string[]>();
    for (const p of delivery.repro_tests ?? []) {
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
    // a browser repro needs the repo's build output at base and at the fix, copied out to /out
    const outDir = path.join(ws.dir, 'replay', `${step.node_key}-${step.attempt_no}`);
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    const build = (when: string) =>
      browser
        ? [
            run(`${when}-build-${browser.repo}`, browser.repo, target!.build_command),
            `cp -R /work/${browser.repo}/${sh(target!.dist_dir!)} /out/${when}-dist`,
          ]
        : [];
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
      // the base build is of the base code alone, without the repro tests
      ...(browser
        ? [
            ...changes.map((c) => `cd /work/${c.repo} && git reset -q --hard && git clean -fdq`),
            ...build('base'),
          ]
        : []),
      // head: the fix
      ...changes.map((c) => `cd /work/${c.repo} && git checkout -q -f ${c.head_sha}`),
      ...reproRuns('head'),
      ...build('head'),
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
      mounts: [...ws.state.mounts, { host: outDir, container: '/out' }],
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

    // the browser runs, once per build, in a container with no network (06 §5.2)
    let runs: { base: BrowserRunResult; head: BrowserRunResult } | null = null;
    if (browser && passes(`base-build-${browser.repo}`) && passes(`head-build-${browser.repo}`)) {
      digests[`browser_repro:${browser.repo}`] = crypto
        .createHash('sha256')
        .update(JSON.stringify(browser))
        .digest('hex');
      ensureImage(BROWSER_IMAGE);
      const sandbox: AgentSandbox = {
        start(s) {
          const c = startContainer({
            image: BROWSER_IMAGE,
            network: 'none',
            mounts: s.mounts ?? [],
            env: s.env,
            script: s.command,
            workdir: '/tmp',
            labels: o.labels,
            signal,
            limits: { memory: '2g', timeoutMs: 5 * 60_000 },
          });
          return {
            stdin: c.child.stdin,
            stdout: c.child.stdout,
            exited: c.done.then((x) => x.exitCode),
            kill: c.kill,
          };
        },
      };
      const runOn = (when: 'base' | 'head') =>
        runBrowserRepro({
          sandbox,
          repro: browser,
          distDir: path.join(outDir, `${when}-dist`),
          envUrl: envUrl!,
          assetUrlPatterns: target!.asset_url_patterns!,
          outDir: path.join(outDir, 'shots'),
          prefix: when,
          signal,
        });
      runs = { base: await runOn('base'), head: await runOn('head') };
    }

    const verdict = {
      ...(repos.length
        ? {
            repro_fails_before: repos.every((x) => fails(`base-repro-${x}`)),
            repro_passes_after: repos.every((x) => passes(`head-repro-${x}`)),
          }
        : {}),
      ...(browser
        ? {
            browser_fails_before: !!runs?.base.failed_on_assert,
            browser_passes_after: !!runs?.head.passed,
            replacement_invariants:
              !!runs &&
              invariantsHold(runs.base.invariants) &&
              invariantsHold(runs.head.invariants),
          }
        : {}),
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
      ...(browser && runs
        ? {
            browser: {
              repo: browser.repo,
              env_url: envUrl,
              base: summary(runs.base),
              head: summary(runs.head),
            },
          }
        : {}),
      // a repro that fails before the fix only because it does not compile proves little
      repro_failed_on_assertion: repos.filter((x) => asserted.includes(`base-repro-${x}`)),
      digests,
      ms: r.ms,
    };
    if (!ok) {
      const bad = [
        ...Object.keys(results).filter((k) =>
          k.startsWith('base-') && !k.startsWith('base-build-') ? !fails(k) : !passes(k),
        ),
        ...Object.entries(verdict)
          .filter(([k, v]) => !v && k.startsWith('browser_'))
          .map(([k]) => k),
        ...(browser && runs && !verdict.replacement_invariants ? ['replacement_invariants'] : []),
      ];
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

/** What the node output keeps of a browser run: verdict facts, evidence files, redacted errors. */
function summary(r: BrowserRunResult) {
  return {
    passed: r.passed,
    failed_step: r.failed_step,
    failed_on_assert: r.failed_on_assert,
    steps: r.steps,
    invariants: r.invariants,
    screenshots: r.screenshots,
    console_errors: r.console_errors.slice(0, 20),
    network_errors: r.network_errors.slice(0, 20),
    stale: r.stale.slice(0, 20),
    denied: r.denied.slice(0, 20),
    ...(r.error ? { error: r.error } : {}),
    ms: r.ms,
  };
}
