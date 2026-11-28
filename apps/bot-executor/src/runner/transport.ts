// RunnerTransport client over HTTP (docs/06 §5.3a). The executor never touches the database.
import {
  RUNNER_PATHS,
  type CompleteStepRequest,
  type CompleteStepResponse,
  type CredentialEnvelope,
  type FetchCredentialRequest,
  type HeartbeatRequest,
  type HeartbeatResponse,
  type RegisterRunnerRequest,
  type RegisterRunnerResponse,
} from '@cloudcraft/core-protocol';

/** A refused call; `code` is the server's ApiError code (e.g. runner.lease_lost). */
export class RunnerApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'RunnerApiError';
  }
}

export interface RunnerCredentials {
  runnerId: string;
  secret: string;
}

export function httpTransport(server: string) {
  async function call<T>(path: string, body: unknown, creds?: RunnerCredentials): Promise<T> {
    const r = await fetch(new URL(path, server), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(creds ? { authorization: `Runner ${creds.runnerId}:${creds.secret}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    const json = (await r.json().catch(() => ({}))) as { code?: string; message?: string };
    if (!r.ok)
      throw new RunnerApiError(r.status, json.code ?? 'unknown', json.message ?? r.statusText);
    return json as T;
  }
  return {
    registerRunner: (req: RegisterRunnerRequest) =>
      call<RegisterRunnerResponse>(RUNNER_PATHS.registerRunner, req),
    heartbeatAndPoll: (creds: RunnerCredentials, req: HeartbeatRequest) =>
      call<HeartbeatResponse>(RUNNER_PATHS.heartbeatAndPoll, req, creds),
    completeRoundStep: (creds: RunnerCredentials, req: CompleteStepRequest) =>
      call<CompleteStepResponse>(RUNNER_PATHS.completeRoundStep, req, creds),
    fetchCredential: (creds: RunnerCredentials, req: FetchCredentialRequest) =>
      call<CredentialEnvelope>(RUNNER_PATHS.fetchCredential, req, creds),
  };
}

export type RunnerTransport = ReturnType<typeof httpTransport>;
