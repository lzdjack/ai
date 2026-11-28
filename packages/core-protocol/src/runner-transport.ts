// RunnerTransport (docs/06 §5.3a, §2.12): how an executor talks to cc-app. Executors never connect
// to the database; every call is authenticated by the runner's long-term secret, and every write-back
// carries the lease token and fence it was handed, so a runner that lost its lease cannot write.
//
// Implemented now (E1): registerRunner, heartbeatAndPoll, completeRoundStep, over HTTP POST with JSON
// bodies of at most RUNNER_FRAME_LIMIT bytes. reportRoundEvent and streamLogChunk come with P4 (the
// pages that show them), requestPresignedUpload with E2's evidence, fetchEncryptedBundle with P3.
import { Type, type Static } from 'typebox';

/** control frames stay small; logs, recordings and bundles go through presigned uploads */
export const RUNNER_FRAME_LIMIT = 64 * 1024;
/** structured output of one step, inside a frame */
export const STEP_OUTPUT_LIMIT = 16 * 1024;

export const RUNNER_PATHS = {
  registerRunner: '/v1/runner/register',
  heartbeatAndPoll: '/v1/runner/heartbeat',
  completeRoundStep: '/v1/runner/complete',
  fetchCredential: '/v1/runner/credential',
  uploadEvidence: '/v1/runner/evidence',
} as const;

/** One evidence file (a screenshot) per upload; M1 keeps them on the server's disk (06 §6.2). */
export const EVIDENCE_LIMIT = 4 * 1024 * 1024;

/** Prefix of the one-time enrollment token; the long-term secret has its own prefix. */
export const ENROLL_TOKEN_PREFIX = 'cc_run_live_';
export const RUNNER_SECRET_PREFIX = 'cc_run_key_';

export const RegisterRunnerRequest = Type.Object({
  enroll_token: Type.String({ minLength: 20, maxLength: 200 }),
  /** X25519 public key (base64 SPKI DER) of the bot_exec key pair; the private key stays on the host */
  bot_exec_public_key: Type.String({ minLength: 40, maxLength: 200 }),
  /** sha256 of the long-term secret the runner generated; the secret itself is never sent */
  secret_sha256: Type.String({ pattern: '^[0-9a-f]{64}$' }),
});
export type RegisterRunnerRequest = Static<typeof RegisterRunnerRequest>;

export const RegisterRunnerResponse = Type.Object({
  runner_id: Type.String({ format: 'uuid' }),
  workspace_id: Type.String({ format: 'uuid' }),
  lease_seconds: Type.Integer(),
  poll_ms: Type.Integer(),
});
export type RegisterRunnerResponse = Static<typeof RegisterRunnerResponse>;

export const LeaseRef = Type.Object({
  work_item_id: Type.String({ format: 'uuid' }),
  lease_token: Type.String({ format: 'uuid' }),
});
export type LeaseRef = Static<typeof LeaseRef>;

export const HeartbeatRequest = Type.Object({
  /** steps the runner can take on now; 0 just renews */
  free_slots: Type.Integer({ minimum: 0, maximum: 32 }),
  /** leases the runner is still working on */
  leases: Type.Array(LeaseRef, { maxItems: 64 }),
});
export type HeartbeatRequest = Static<typeof HeartbeatRequest>;

export const RepoSpec = Type.Object({
  id: Type.String(),
  name: Type.String(),
  clone_url: Type.String(),
  ref: Type.String(),
  build_command: Type.String(),
  /** runs the repo's tests; extra arguments are test files (replay, 06 §5.7) */
  test_command: Type.Optional(Type.String()),
  typecheck_command: Type.Optional(Type.String()),
  /**
   * How a fix of this repo is checked (06 §5.7): 'browser_dist_replace' also replays a browser repro
   * on the test environment with the repo's build output swapped in; default 'test_suite'.
   */
  verify_strategy: Type.Optional(
    Type.Union([Type.Literal('test_suite'), Type.Literal('browser_dist_replace')]),
  ),
  /** build output directory, relative to the repo (browser_dist_replace) */
  dist_dir: Type.Optional(Type.String()),
  /**
   * URL prefixes of this app's assets on the environment page, absolute or a path on the page's
   * origin, e.g. /assets/ (06 §5.2 DistAssetMatcher)
   */
  asset_url_patterns: Type.Optional(Type.Array(Type.String())),
  /** secret the executor fetches as an envelope to clone and push (06 §2.10); none: public or local */
  credential_ref: Type.Optional(Type.String({ format: 'uuid' })),
});
export type RepoSpec = Static<typeof RepoSpec>;

/** One node run handed to a runner, with everything it needs except credentials. */
export const StepAssignment = Type.Object({
  work_item_id: Type.String({ format: 'uuid' }),
  lease_token: Type.String({ format: 'uuid' }),
  fence: Type.Integer(),
  lease_expires_at: Type.String(),
  flow_instance_id: Type.String({ format: 'uuid' }),
  node_run_id: Type.String({ format: 'uuid' }),
  node_key: Type.String(),
  node_kind: Type.String(),
  attempt_no: Type.Integer(),
  /** set for per_repo nodes */
  repo_id: Type.Union([Type.String(), Type.Null()]),
  config: Type.Record(Type.String(), Type.Unknown()),
  /** the round's repos in dependency order (frozen in the plan) */
  repos: Type.Array(RepoSpec),
});
export type StepAssignment = Static<typeof StepAssignment>;

export const HeartbeatResponse = Type.Object({
  /** leases that are gone: stop that work now, its result will be refused */
  lost: Type.Array(Type.String({ format: 'uuid' })),
  assigned: Type.Array(StepAssignment),
  poll_ms: Type.Integer(),
});
export type HeartbeatResponse = Static<typeof HeartbeatResponse>;

export const CompleteStepRequest = Type.Object({
  work_item_id: Type.String({ format: 'uuid' }),
  lease_token: Type.String({ format: 'uuid' }),
  fence: Type.Integer(),
  outcome: Type.Union([Type.Literal('done'), Type.Literal('failed')]),
  /** what the step found, e.g. per-repo build results with timings and an output tail */
  output: Type.Record(Type.String(), Type.Unknown()),
  error: Type.Optional(Type.String({ maxLength: 4000 })),
  /**
   * The runner keeps the flow's workspace and wants the flow's next sandbox step, if the write-back
   * opened one: a segment of execution nodes stays on one runner (06 §2.12). False while draining.
   */
  take_next: Type.Optional(Type.Boolean()),
});
export type CompleteStepRequest = Static<typeof CompleteStepRequest>;

export const CompleteStepResponse = Type.Object({
  accepted: Type.Boolean(),
  /** the flow's next sandbox step, already leased to this runner (only with take_next) */
  next: Type.Optional(StepAssignment),
});
export type CompleteStepResponse = Static<typeof CompleteStepResponse>;

/** Error codes a runner reacts to (ApiError.code). */
export const RUNNER_ERRORS = {
  unauthorized: 'runner.unauthorized',
  leaseLost: 'runner.lease_lost',
  outputTooLarge: 'runner.output_too_large',
} as const;

/** The credential of one repo of a step the runner holds, sealed to the runner's bot_exec key. */
export const FetchCredentialRequest = Type.Object({
  work_item_id: Type.String({ format: 'uuid' }),
  lease_token: Type.String({ format: 'uuid' }),
  fence: Type.Integer(),
  secret_id: Type.String({ format: 'uuid' }),
});
export type FetchCredentialRequest = Static<typeof FetchCredentialRequest>;

/** An evidence file of the step this runner holds; the server checks the lease and the sha256. */
export const UploadEvidenceRequest = Type.Object({
  work_item_id: Type.String({ format: 'uuid' }),
  lease_token: Type.String({ format: 'uuid' }),
  fence: Type.Integer(),
  name: Type.String({ pattern: '^[A-Za-z0-9._-]{1,120}$' }),
  sha256: Type.String({ pattern: '^[0-9a-f]{64}$' }),
  content_type: Type.Literal('image/png'),
  data_base64: Type.String({ maxLength: Math.ceil((EVIDENCE_LIMIT * 4) / 3) + 4 }),
});
export type UploadEvidenceRequest = Static<typeof UploadEvidenceRequest>;

/** Name of a replay screenshot as uploaded and as the delivery card lists it (base / head side). */
export const evidenceName = (side: 'base' | 'head', name: string) =>
  `${side}-${name}`.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120);
