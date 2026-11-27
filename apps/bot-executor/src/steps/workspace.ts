// A flow's workspace on this executor (docs/06 §5.1 host_prepare, §5.3): the repos cloned on the
// host on the flow's fix/ branch, dependencies installed in two phases, kept while the flow's
// segment of execution nodes runs here (06 §2.12) and removed when the segment ends. A step that
// finds no workspace (another executor started the segment, or this one restarted) prepares it
// again from the pushed fix/ branch, or from the base ref when nothing was pushed yet.
import fs from 'node:fs';
import path from 'node:path';
import type { RepoSpec, StepAssignment } from '@cloudcraft/core-protocol';
import type { SubmitDelivery } from '@cloudcraft/mcp-tool-host';
import type { GitAuth } from '../runner/credentials.ts';
import { installRoundDeps } from '../sandbox/deps.ts';
import type { Mount } from '../sandbox/docker.ts';
import { BOT_AUTHOR, clone, git } from './git.ts';

export interface RepoChange {
  repo: string;
  base_sha: string;
  head_sha: string;
  /** git name-status against base, e.g. "M src/a.ts" */
  files: string[];
  /** lines added / deleted against base (risk level, 06 §5.7) */
  added: number;
  deleted: number;
}

export interface WorkspaceState {
  branch: string;
  mounts: Mount[];
  /** set by the AI node: what the model delivered and what the host committed */
  delivery?: SubmitDelivery;
  changes?: RepoChange[];
}

export interface Workspace {
  dir: string;
  /** mounted at /work */
  workDir: string;
  repos: RepoSpec[];
  state: WorkspaceState;
  save(): void;
}

export interface WorkspaceOptions {
  image: string;
  root: string;
  cacheRoot: string;
  gitAuth: GitAuth;
  labels?: Record<string, string>;
}

export class WorkspaceError extends Error {}

/** E2 names the branch after the flow; P4 switches to fix/<slug>/<no> from the ticket. */
export const branchFor = (flowId: string) => `fix/${flowId.slice(0, 8)}`;

export class Workspaces {
  constructor(private o: WorkspaceOptions) {}

  private dirOf(flowId: string) {
    return path.join(this.o.root, `flow-${flowId}`);
  }

  private open(dir: string, repos: RepoSpec[]): Workspace | null {
    const file = path.join(dir, 'state.json');
    if (!fs.existsSync(file)) return null;
    const ws: Workspace = {
      dir,
      workDir: path.join(dir, 'work'),
      repos,
      state: JSON.parse(fs.readFileSync(file, 'utf8')) as WorkspaceState,
      save: () => fs.writeFileSync(file, JSON.stringify(ws.state, null, 2)),
    };
    return ws;
  }

  /** The workspace if this executor holds it (no preparing). */
  get(step: StepAssignment): Workspace | null {
    return this.open(this.dirOf(step.flow_instance_id), step.repos);
  }

  async ensure(
    step: StepAssignment,
    signal: AbortSignal,
  ): Promise<{ ws: Workspace; timings: { label: string; ms: number }[] }> {
    const dir = this.dirOf(step.flow_instance_id);
    const held = this.open(dir, step.repos);
    if (held) return { ws: held, timings: [] };

    fs.rmSync(dir, { recursive: true, force: true });
    const workDir = path.join(dir, 'work');
    fs.mkdirSync(workDir, { recursive: true });
    // P4: the round's branch comes with the plan (fix/<project>/<ticket no>); drills fall back
    const branch =
      typeof step.config.branch === 'string'
        ? step.config.branch
        : branchFor(step.flow_instance_id);
    const timings: { label: string; ms: number }[] = [];
    const t0 = Date.now();
    for (const r of step.repos) {
      const auth = { ...(await this.o.gitAuth(step, r)), signal };
      const repoDir = path.join(workDir, r.name);
      await clone(r.clone_url, r.ref, repoDir, auth);
      const pushed = (await git(repoDir, ['ls-remote', '--heads', 'origin', branch], auth)).trim();
      if (pushed) {
        await git(repoDir, ['fetch', '-q', 'origin', branch], auth);
        await git(repoDir, ['checkout', '-qb', branch, 'FETCH_HEAD']);
      } else await git(repoDir, ['checkout', '-qb', branch]);
    }
    timings.push({ label: 'clone', ms: Date.now() - t0 });

    const deps = await installRoundDeps({
      image: this.o.image,
      workDir,
      repos: step.repos.map((r) => r.name),
      cacheRoot: this.o.cacheRoot,
      roundDir: dir,
      signal,
      labels: this.o.labels,
    });
    timings.push(...deps.steps);
    if (!deps.ok) {
      fs.rmSync(dir, { recursive: true, force: true });
      throw new WorkspaceError(`${deps.label}: ${deps.result.output.slice(-2000)}`);
    }
    // keep node_modules and caches out of the change set
    for (const r of step.repos)
      fs.appendFileSync(path.join(workDir, r.name, '.git', 'info', 'exclude'), '\nnode_modules/\n');
    fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify({ branch, mounts: deps.mounts }));
    return { ws: this.open(dir, step.repos)!, timings };
  }

  release(flowId: string) {
    fs.rmSync(this.dirOf(flowId), { recursive: true, force: true });
  }
}

/** The commit the round's changes are measured from: where the fix branch left the base ref. */
export async function baseOf(ws: Workspace, r: RepoSpec): Promise<string> {
  const dir = path.join(ws.workDir, r.name);
  return (await git(dir, ['merge-base', 'HEAD', `origin/${r.ref}`])).trim();
}

/** Commits whatever the agent left in the work tree, per repo; returns each repo's change set. */
export async function commitChanges(ws: Workspace, message: string): Promise<RepoChange[]> {
  const out: RepoChange[] = [];
  for (const r of ws.repos) {
    const dir = path.join(ws.workDir, r.name);
    if ((await git(dir, ['status', '--porcelain', '--untracked-files=all'])).trim()) {
      await git(dir, ['add', '-A']);
      await git(dir, [...BOT_AUTHOR, 'commit', '-qm', message]);
    }
    const base = await baseOf(ws, r);
    const head = (await git(dir, ['rev-parse', 'HEAD'])).trim();
    if (head === base) continue;
    const files = (await git(dir, ['diff', '--name-status', '--no-renames', base, head]))
      .split('\n')
      .filter(Boolean)
      .map((l) => l.replace(/\t/, ' '));
    let added = 0;
    let deleted = 0;
    for (const l of (await git(dir, ['diff', '--numstat', '--no-renames', base, head])).split(
      '\n',
    )) {
      const [a, d] = l.split('\t');
      if (a && a !== '-') added += Number(a);
      if (d && d !== '-') deleted += Number(d);
    }
    out.push({
      repo: r.name,
      base_sha: base,
      head_sha: head,
      files: files.slice(0, 200),
      added,
      deleted,
    });
  }
  return out;
}

const TEST_FILE = /(^|\/)(__tests__\/|[^/]+\.(test|spec)\.[cm]?[jt]sx?$)/;
const TEST_CONFIG =
  /(^|\/)((vitest|vite|jest|playwright)\.config\.[cm]?[jt]s|setupTests?\.[cm]?[jt]sx?)$/;

/** Existing tests or test config the change touched (06 §5.7: counts as L2, never silently). */
export function touchedTests(changes: RepoChange[], reproTests: string[]): string[] {
  return changes.flatMap((c) =>
    c.files
      .map((f) => [f.slice(0, 1), f.slice(2)] as const)
      .filter(
        ([st, p]) =>
          (TEST_CONFIG.test(p) || (TEST_FILE.test(p) && st !== 'A')) &&
          !reproTests.includes(`${c.repo}/${p}`),
      )
      .map(([st, p]) => `${st} ${c.repo}/${p}`),
  );
}

export const isTestConfig = (p: string) => TEST_CONFIG.test(p);
