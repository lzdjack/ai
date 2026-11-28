// What the release executor runs (docs/06 §1.2, §3.3, §6.3, §7.1, §7.4): merge an MR, craft publish,
// craft release, craft verify — each through a fixed, trusted connector plugin with the acting
// person's own account, opened here with the release_exec key. No repository code ever runs here.
//
// Every step that changes the outside world looks first when the server says an earlier attempt
// ended without an outcome (read_back_first), and the release step never goes backwards (不倒退):
// it refuses when the environment runs something that is not in this build.
import fs from 'node:fs';
import {
  isCodeSource,
  isReleaseProvider,
  type ConnectorPlugin,
  type ReleaseContext,
  type StepAssignment,
  type StepSecrets,
} from '@cloudcraft/core-protocol';
import { openFromServer } from '@cloudcraft/core-protocol/envelope';
import type { StepHandler, StepResult } from '../runner/loop.ts';
import type { RunnerCredentials, RunnerTransport } from '../runner/transport.ts';

export interface ReleaseStepDeps {
  transport: RunnerTransport;
  creds: RunnerCredentials;
  keyFile: string;
  plugins: Map<string, ConnectorPlugin>;
}

const lease = (s: StepAssignment) => ({
  work_item_id: s.work_item_id,
  lease_token: s.lease_token,
  fence: s.fence,
});

async function secretsOf(d: ReleaseStepDeps, step: StepAssignment) {
  const env = await d.transport.fetchStepSecrets(d.creds, lease(step));
  const s = openFromServer(fs.readFileSync(d.keyFile, 'utf8'), env) as unknown as StepSecrets;
  const plugin = d.plugins.get(s.plugin_id);
  if (!plugin) throw new Error(`connector plugin ${s.plugin_id} is not installed on this executor`);
  return { s, plugin };
}

const failed = (error: string, output: Record<string, unknown> = {}): StepResult => ({
  outcome: 'failed',
  output,
  error: error.slice(0, 4000),
});

/** 合入 (05 steps 6, 10): with the merger's own token, only if the source head is the reviewed one. */
function merge(d: ReleaseStepDeps): StepHandler {
  return async (step) => {
    const { s, plugin } = await secretsOf(d, step);
    if (!isCodeSource(plugin)) return failed(`${s.plugin_id} is not a code source`);
    const c = step.config as {
      remote_id: string;
      mr_iid: string;
      expected_sha: string;
      message: string;
    };
    // a merge that happened before the executor could report it counts as done (06 §3.3)
    const now = await plugin.getMergeRequest(s.config, s.personal, c.remote_id, c.mr_iid);
    if (now.state === 'merged')
      return { outcome: 'done', output: { merge_sha: now.merge_sha, read_back: true } };
    try {
      const r = await plugin.mergeMergeRequest(s.config, s.personal, c.remote_id, c.mr_iid, {
        expected_sha: c.expected_sha,
        message: c.message,
      });
      return { outcome: 'done', output: { merge_sha: r.merge_sha } };
    } catch (e) {
      const reason = (e as { reason?: string }).reason ?? 'other';
      return failed(`merge refused (${reason}): ${(e as Error).message}`, { refusal: reason });
    }
  };
}

function releaseCtx(s: StepSecrets, step: StepAssignment): ReleaseContext {
  return {
    config: s.config,
    credential: s.credential,
    personal: s.personal,
    target: (step.config.target ?? {}) as Record<string, unknown>,
  };
}

/** craft publish: the build's files by sha256, uploaded with the provider's key. */
function publish(d: ReleaseStepDeps): StepHandler {
  return async (step) => {
    const { s, plugin } = await secretsOf(d, step);
    if (!isReleaseProvider(plugin)) return failed(`${s.plugin_id} is not a release provider`);
    const c = step.config as {
      version: string;
      commit: string;
      files: { path: string; sha256: string }[];
    };
    const files = [];
    for (const f of c.files) {
      const r = await d.transport.fetchArtifact(d.creds, { ...lease(step), sha256: f.sha256 });
      files.push({ path: f.path, sha256: f.sha256, data: Buffer.from(r.data_base64, 'base64') });
    }
    const r = await plugin.publish(releaseCtx(s, step), {
      version: c.version,
      commit: c.commit,
      files,
    });
    return {
      outcome: 'done',
      output: {
        ...r,
        command: 'craft publish',
        log_tail: `uploaded ${r.uploaded}, skipped ${r.skipped}`,
      },
    };
  };
}

async function contains(
  d: ReleaseStepDeps,
  step: StepAssignment,
  ancestor: string,
  descendant: string,
) {
  if (ancestor === descendant) return true;
  const r = await d.transport.checkAncestry(d.creds, {
    ...lease(step),
    repo_id: String(step.config.repo_id),
    ancestor,
    descendant,
  });
  return r.is_ancestor;
}

/** craft release --env: 三段写回 with the clicker's account, never backwards (06 §7.4.2). */
function release(d: ReleaseStepDeps): StepHandler {
  return async (step) => {
    const { s, plugin } = await secretsOf(d, step);
    if (!isReleaseProvider(plugin)) return failed(`${s.plugin_id} is not a release provider`);
    const c = step.config as {
      provider_env: string;
      version: string;
      commit: string;
      location: Record<string, unknown>;
      title: string;
    };
    const ctx = releaseCtx(s, step);
    const live = await plugin.current(ctx, c.provider_env);
    if (live?.commit === c.commit)
      // released before the executor could report it (or by an earlier attempt): nothing to redo
      return { outcome: 'done', output: { revision: live.revision, read_back: true } };
    if (live && !(await contains(d, step, live.commit, c.commit))) {
      if (await contains(d, step, c.commit, live.commit))
        return {
          outcome: 'done',
          output: { revision: live.revision, already_contained: live.version },
        };
      return failed(
        `superseded: ${c.provider_env} runs ${live.version} (${live.commit.slice(0, 7)}), which is not in this build`,
      );
    }
    const r = await plugin.release(ctx, {
      env: c.provider_env,
      version: c.version,
      commit: c.commit,
      location: c.location,
      title: c.title,
    });
    return { outcome: 'done', output: { revision: r.revision, command: r.command } };
  };
}

/** craft verify --env: the environment's CommitId is this build, or a later one that contains it. */
function verify(d: ReleaseStepDeps): StepHandler {
  return async (step) => {
    const { s, plugin } = await secretsOf(d, step);
    if (!isReleaseProvider(plugin)) return failed(`${s.plugin_id} is not a release provider`);
    const c = step.config as { provider_env: string; expect_commit: string };
    const live = await plugin.current(releaseCtx(s, step), c.provider_env);
    if (!live) return failed(`verify: nothing is released on ${c.provider_env}`);
    const out = { version: live.version, commit: live.commit, revision: live.revision };
    if (live.commit === c.expect_commit) return { outcome: 'done', output: out };
    if (await contains(d, step, c.expect_commit, live.commit))
      return { outcome: 'done', output: { ...out, contains_this_build: true } };
    return failed(
      `superseded: ${c.provider_env} runs ${live.version} (${live.commit.slice(0, 7)}), expected ${c.expect_commit.slice(0, 7)}`,
      out,
    );
  };
}

export function releaseHandlers(d: ReleaseStepDeps): Record<string, StepHandler> {
  return { merge: merge(d), publish: publish(d), release: release(d), verify: verify(d) };
}
