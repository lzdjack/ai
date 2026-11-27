// Trial build (docs/06 §5.3, 07 E1): clone the round's repos on the host, prepare dependencies
// online, then install and build every repo in a --network=none container. The git credential stays
// on the host (sent as a header, never written into .git/config or the container).
import fs from 'node:fs';
import path from 'node:path';
import type { StepAssignment } from '@cloudcraft/core-protocol';
import type { StepHandler, StepResult } from '../runner/loop.ts';
import { installRoundDeps } from '../sandbox/deps.ts';
import { runContainer } from '../sandbox/docker.ts';
import type { GitAuth } from '../runner/credentials.ts';
import { clone } from './git.ts';

const TAIL = 2000;
const tail = (s: string) => (s.length > TAIL ? s.slice(-TAIL) : s);

export interface TrialBuildOptions {
  image: string;
  /** shared dependency caches, keyed by image + lockfile */
  cacheRoot: string;
  /** per-step work directories go below this */
  workRoot: string;
  /** credential per repo: an envelope from the server, or the executor's own token (drills) */
  gitAuth: GitAuth;
  /** labels for every container of this executor (crash cleanup) */
  labels?: Record<string, string>;
}

export function trialBuild(o: TrialBuildOptions): StepHandler {
  return async (step: StepAssignment, signal: AbortSignal): Promise<StepResult> => {
    const roundDir = path.join(o.workRoot, `${step.node_run_id}-${step.fence}`);
    const workDir = path.join(roundDir, 'work');
    const timings: { label: string; ms: number }[] = [];
    try {
      const t0 = Date.now();
      fs.mkdirSync(workDir, { recursive: true });
      for (const r of step.repos)
        await clone(r.clone_url, r.ref, path.join(workDir, r.name), {
          ...(await o.gitAuth(step, r)),
          signal,
        });
      timings.push({ label: 'clone', ms: Date.now() - t0 });

      const deps = await installRoundDeps({
        image: o.image,
        workDir,
        repos: step.repos.map((r) => r.name),
        cacheRoot: o.cacheRoot,
        roundDir,
        signal,
        labels: o.labels,
      });
      timings.push(...deps.steps);
      if (!deps.ok)
        return {
          outcome: 'failed',
          output: { timings },
          error: `${deps.label}: ${tail(deps.result.output)}`,
        };

      const builds = [];
      for (const r of step.repos) {
        const b = await runContainer({
          image: o.image,
          network: 'none',
          mounts: deps.mounts,
          script: `cd /work/${r.name} && ${r.build_command}`,
          signal,
          labels: o.labels,
        });
        builds.push({
          repo: r.name,
          ok: b.ok,
          ms: b.ms,
          timed_out: b.timedOut,
          output_tail: tail(b.output),
        });
        if (!b.ok) break;
      }
      const ok = builds.length === step.repos.length && builds.every((b) => b.ok);
      return {
        outcome: ok ? 'done' : 'failed',
        output: { network: 'none', timings, builds },
        ...(ok ? {} : { error: `build failed: ${builds.find((b) => !b.ok)?.repo}` }),
      };
    } finally {
      fs.rmSync(roundDir, { recursive: true, force: true });
    }
  };
}
