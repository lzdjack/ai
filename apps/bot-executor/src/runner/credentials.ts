// How the executor authenticates git for a repo of a step (docs/06 §2.10): a repo with a credential
// reference gets it as an envelope sealed to this executor's bot_exec key, opened here with the
// private key that never leaves this host, and used as an HTTP header for one command. Repos without
// a reference (local drills) fall back to the executor's own token, if configured.
import fs from 'node:fs';
import type { RepoSpec, StepAssignment } from '@cloudcraft/core-protocol';
import { openFromServer } from '@cloudcraft/core-protocol/envelope';
import type { RunnerCredentials, RunnerTransport } from './transport.ts';

export interface GitCredential {
  /** full header line, e.g. "Authorization: Basic …" */
  header?: string;
  token?: string;
}
export type GitAuth = (step: StepAssignment, repo: RepoSpec) => Promise<GitCredential>;

export function gitAuthSource(o: {
  transport: RunnerTransport;
  creds: RunnerCredentials;
  keyFile: string;
  fallbackToken?: string;
}): GitAuth {
  return async (step, repo) => {
    if (!repo.credential_ref) return o.fallbackToken ? { token: o.fallbackToken } : {};
    const env = await o.transport.fetchCredential(o.creds, {
      work_item_id: step.work_item_id,
      lease_token: step.lease_token,
      fence: step.fence,
      secret_id: repo.credential_ref,
    });
    const payload = openFromServer(fs.readFileSync(o.keyFile, 'utf8'), env);
    return { header: String(payload.git_http_header) };
  };
}
