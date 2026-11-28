// craft build in the build sandbox (docs/06 §7.1, §7.3; 05 steps 7, 12): the newest commit of the
// release's branch (test branch / main — never a reused test package), dependencies prepared online,
// then built in a --network=none container with no credentials. Only the artifact and its sha256
// manifest leave: uploaded to cc-app, which accepts it only if the commit contains the reviewed merge.
// The version is read from the build, never typed in: package.json version + the commit.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { StepAssignment, UploadArtifactRequest } from '@cloudcraft/core-protocol';
import type { GitAuth } from '../runner/credentials.ts';
import type { StepHandler, StepResult } from '../runner/loop.ts';
import { installRoundDeps } from '../sandbox/deps.ts';
import { runContainer } from '../sandbox/docker.ts';
import { clone, git } from './git.ts';

const TAIL = 2000;
const tail = (s: string) => (s.length > TAIL ? s.slice(-TAIL) : s);

export interface ReleaseBuildOptions {
  image: string;
  cacheRoot: string;
  workRoot: string;
  gitAuth: GitAuth;
  labels?: Record<string, string>;
  upload: (
    step: StepAssignment,
    a: Omit<UploadArtifactRequest, 'work_item_id' | 'lease_token' | 'fence'>,
  ) => Promise<unknown>;
}

function filesOf(root: string, rel = ''): string[] {
  return fs.readdirSync(path.join(root, rel), { withFileTypes: true }).flatMap((e) => {
    const r = rel ? `${rel}/${e.name}` : e.name;
    return e.isDirectory() ? filesOf(root, r) : [r];
  });
}

export function releaseBuild(o: ReleaseBuildOptions): StepHandler {
  return async (step, signal): Promise<StepResult> => {
    const target = String(step.config.target_repo);
    const ref = String(step.config.ref);
    const spec = step.repos.find((r) => r.name === target);
    if (!spec) return { outcome: 'failed', output: {}, error: `repo ${target} not in step` };
    const dir = path.join(o.workRoot, `build-${step.node_run_id}-${step.fence}`);
    const workDir = path.join(dir, 'work');
    try {
      fs.mkdirSync(workDir, { recursive: true });
      // the target at the release branch; the repos it links to at their default branch
      for (const r of step.repos)
        await clone(r.clone_url, r.name === target ? ref : r.ref, path.join(workDir, r.name), {
          ...(await o.gitAuth(step, r)),
          signal,
        });
      const commit = (await git(path.join(workDir, target), ['rev-parse', 'HEAD'])).trim();
      const deps = await installRoundDeps({
        image: o.image,
        workDir,
        repos: step.repos.map((r) => r.name),
        cacheRoot: o.cacheRoot,
        roundDir: dir,
        signal,
        labels: o.labels,
      });
      if (!deps.ok)
        return {
          outcome: 'failed',
          output: { commit, log_tail: tail(deps.result.output) },
          error: `${deps.label}: ${tail(deps.result.output)}`,
        };
      // build in dependency order up to the target (it links to the libraries' build output)
      for (const r of step.repos) {
        const b = await runContainer({
          image: o.image,
          network: 'none',
          mounts: deps.mounts,
          script: `cd /work/${r.name} && ${r.build_command}`,
          signal,
          labels: o.labels,
        });
        if (!b.ok)
          return {
            outcome: 'failed',
            output: { commit, log_tail: tail(b.output) },
            error: `build failed: ${r.name}\n${tail(b.output)}`,
          };
        if (r.name === target) break;
      }
      const dist = path.join(workDir, target, spec.dist_dir ?? 'dist');
      if (!fs.existsSync(dist))
        return { outcome: 'failed', output: { commit }, error: `no ${spec.dist_dir ?? 'dist'}/` };
      const pkg = JSON.parse(
        fs.readFileSync(path.join(workDir, target, 'package.json'), 'utf8'),
      ) as {
        version?: string;
      };
      const version = `${pkg.version ?? '0.0.0'}-${commit.slice(0, 7)}`;
      const files = filesOf(dist).map((rel) => {
        const data = fs.readFileSync(path.join(dist, rel));
        return {
          path: rel,
          sha256: crypto.createHash('sha256').update(data).digest('hex'),
          data_base64: data.toString('base64'),
        };
      });
      await o.upload(step, { version, commit, files });
      return {
        outcome: 'done',
        output: { version, commit, files: files.length, network: 'none' },
      };
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };
}
