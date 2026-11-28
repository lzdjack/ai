// Environment sign-in (docs/06 §2.4 env_accounts, §10.3; 01 §11 step 3–4): for each account of the
// step, fetch its secret as an envelope sealed to this executor's bot_exec key, open it here and sign
// in from the browser container (no network; the host answers the page's requests). A refused password
// or an expired cookie is a result, not a failed step: only "could not try at all" fails the step.
import fs from 'node:fs';
import { BROWSER_IMAGE, runBrowserLogin } from '@cloudcraft/browser-sandbox';
import type {
  AgentSandbox,
  EnvLoginResult,
  EnvLoginTarget,
  StepAssignment,
} from '@cloudcraft/core-protocol';
import { openFromServer } from '@cloudcraft/core-protocol/envelope';
import type { StepHandler, StepResult } from '../runner/loop.ts';
import type { RunnerCredentials, RunnerTransport } from '../runner/transport.ts';
import { ensureImage, startContainer } from '../sandbox/docker.ts';

export interface EnvLoginOptions {
  transport: RunnerTransport;
  creds: RunnerCredentials;
  /** this executor's bot_exec private key */
  keyFile: string;
  labels?: Record<string, string>;
}

export function envLogin(o: EnvLoginOptions): StepHandler {
  return async (step: StepAssignment, signal: AbortSignal): Promise<StepResult> => {
    const targets = (step.config.targets ?? []) as EnvLoginTarget[];
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
          limits: { memory: '2g', timeoutMs: 3 * 60_000 },
        });
        return {
          stdin: c.child.stdin,
          stdout: c.child.stdout,
          exited: c.done.then((x) => x.exitCode),
          kill: c.kill,
        };
      },
    };
    const results: EnvLoginResult[] = [];
    for (const t of targets) {
      if (signal.aborted) break;
      const ids = {
        credential_ref: t.credential_ref,
        ...(t.account_id ? { account_id: t.account_id } : {}),
      };
      let secret: string;
      try {
        const env = await o.transport.fetchCredential(o.creds, {
          work_item_id: step.work_item_id,
          lease_token: step.lease_token,
          fence: step.fence,
          secret_id: t.credential_ref,
        });
        secret = String(openFromServer(fs.readFileSync(o.keyFile, 'utf8'), env).secret ?? '');
      } catch (e) {
        results.push({
          ...ids,
          state: 'failed',
          opened: false,
          error: `credential: ${(e as Error).message}`.slice(0, 500),
          ms: 0,
        });
        continue;
      }
      const r = await runBrowserLogin({
        sandbox,
        entryUrl: t.entry_url,
        credentialType: t.credential_type,
        ...(t.account_name ? { accountName: t.account_name } : {}),
        secret,
        signal,
      });
      results.push({ ...ids, ...r });
    }
    if (signal.aborted) return { outcome: 'failed', output: { results }, error: 'aborted' };
    return { outcome: 'done', output: { results } };
  };
}
