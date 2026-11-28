// Connector plugins and repositories (docs/06 §2.4, §6.1, §10.3). A code-source connector only talks to
// its platform; the core never branches on which platform it is. Credentials reach a connector in
// memory for one call and are stored only as envelopes (06 §2.10).
import { Type, type Static, type TSchema } from 'typebox';

export type ConnectorCategory = 'code_source' | 'ticket_source' | 'release' | 'notify';

export interface ConnectorManifest {
  id: string;
  name: string;
  category: ConnectorCategory;
  /** square SVG mark shown on cards and tabs (06 §12: the manifest carries its icon) */
  icon?: string;
  /** JSON Schema of the non-secret settings (e.g. base URL); the drawer renders it */
  configSchema: TSchema;
  /** JSON Schema of the credential (never echoed back) */
  authSchema: TSchema;
  /**
   * JSON Schema of a person's own account on this system (06 §2.3 Plane B, personal_exec): merging
   * with your own GitLab token, releasing with your own Apollo account. Absent: no personal accounts.
   * Stored under the shared connector, usable only by that person, never inherited.
   */
  personalAuthSchema?: TSchema;
}

export interface VerifyResult {
  ok: boolean;
  latency_ms: number;
  identity: string | null;
  scopes: string[];
  /** the account may merge into protected branches: shown as a warning (least privilege) */
  has_merge_perm: boolean | null;
  visible_repo_count: number | null;
  error_raw?: string;
}

export interface RemoteRepo {
  remote_id: string;
  path: string;
  name: string;
  description: string | null;
  default_branch: string;
  clone_url: string;
  web_url: string | null;
}

export interface CodeSourceConnector {
  manifest: ConnectorManifest;
  verify(
    config: Record<string, unknown>,
    credential: Record<string, unknown>,
  ): Promise<VerifyResult>;
  listRepos(
    config: Record<string, unknown>,
    credential: Record<string, unknown>,
    q: { search?: string; page: number; perPage: number },
  ): Promise<{ items: RemoteRepo[]; has_more: boolean }>;
  getRepo(
    config: Record<string, unknown>,
    credential: Record<string, unknown>,
    remoteId: string,
  ): Promise<RemoteRepo>;
  /** file content at a ref, or null when it does not exist */
  readFile(
    config: Record<string, unknown>,
    credential: Record<string, unknown>,
    remoteId: string,
    path: string,
    ref: string,
  ): Promise<string | null>;
  /** head commit of a branch, or null when the branch does not exist (fact check, 06 §5.7) */
  branchHead(
    config: Record<string, unknown>,
    credential: Record<string, unknown>,
    remoteId: string,
    branch: string,
  ): Promise<string | null>;
  /** how the executor authenticates git over HTTP with this credential */
  gitAuth(credential: Record<string, unknown>): { header: string; value: string };
  /**
   * Opens a change request source → target, or returns the open one for the same pair (one active
   * MR per ticket, repo and direction; a rework round pushes onto it, 06 §6.3).
   */
  openMergeRequest(
    config: Record<string, unknown>,
    credential: Record<string, unknown>,
    remoteId: string,
    mr: { source: string; target: string; title: string; description: string },
  ): Promise<MergeRequestInfo>;
  getMergeRequest(
    config: Record<string, unknown>,
    credential: Record<string, unknown>,
    remoteId: string,
    iid: string,
  ): Promise<MergeRequestInfo>;
  /**
   * Merges with a merge commit (no squash, 06 §6.3), only if the source head is still expected_sha.
   * Fails with a MergeRefused whose reason the core reacts to.
   */
  mergeMergeRequest(
    config: Record<string, unknown>,
    credential: Record<string, unknown>,
    remoteId: string,
    iid: string,
    o: { expected_sha: string; message: string },
  ): Promise<MergeRequestInfo>;
  /** git merge-base --is-ancestor (06 §3.3 superseded check) */
  isAncestor(
    config: Record<string, unknown>,
    credential: Record<string, unknown>,
    remoteId: string,
    ancestor: string,
    descendant: string,
  ): Promise<boolean>;
}

export interface MergeRequestInfo {
  /** the platform's number of the change request (GitLab iid) */
  iid: string;
  state: 'open' | 'merged' | 'closed';
  /** current head of the source branch while open */
  head_sha: string | null;
  merge_sha: string | null;
  web_url: string | null;
}

/** Why a merge was refused (06 §6.5): the step fails with this reason and a person decides. */
export type MergeRefusal = 'conflict' | 'head_changed' | 'forbidden' | 'not_open' | 'other';
export class MergeRefused extends Error {
  constructor(
    readonly reason: MergeRefusal,
    message: string,
  ) {
    super(message);
  }
}

// ---------- release providers (06 §7.1, §7.4) ----------

/** Everything a release slot gets: the shared connector, the acting person's account, the target. */
export interface ReleaseContext {
  config: Record<string, unknown>;
  /** the shared connector's credential (e.g. the upload key) */
  credential: Record<string, unknown>;
  /** the account of whoever clicked release / retry (personal_exec, 06 §7.4 item 1) */
  personal: Record<string, unknown>;
  /** release_configs.target_ref: which app / config the target is on the provider */
  target: Record<string, unknown>;
}

/** Built artifact of one target: files with their sha256 (06 §7.1 craft build output). */
export interface ArtifactFile {
  path: string;
  sha256: string;
  data: Buffer;
}

/** What an environment runs now, as the provider reads it back (craft verify). */
export interface LiveVersion {
  version: string;
  commit: string;
  /** provider's own id of what is live (Apollo release id), stored as verified_revision */
  revision: string;
}

/**
 * A release provider plugin (06 §7.1 slots publish / release / verify). It runs only in the release
 * executor, with the acting person's account; it never runs repository code.
 */
export interface ReleaseProviderConnector {
  manifest: ConnectorManifest;
  /** the shared connector's settings and credential */
  verify(
    config: Record<string, unknown>,
    credential: Record<string, unknown>,
  ): Promise<VerifyResult>;
  /** a person's own account (manifest.personalAuthSchema) */
  verifyPersonal(
    config: Record<string, unknown>,
    personal: Record<string, unknown>,
  ): Promise<VerifyResult>;
  /** craft publish: upload by sha256, files already there are skipped; returns where they are */
  publish(
    ctx: ReleaseContext,
    a: { version: string; commit: string; files: ArtifactFile[] },
  ): Promise<{ location: Record<string, unknown>; uploaded: number; skipped: number }>;
  /** craft release --env: switch the environment to this version (env is the provider's code) */
  release(
    ctx: ReleaseContext,
    r: {
      env: string;
      version: string;
      commit: string;
      location: Record<string, unknown>;
      title: string;
    },
  ): Promise<{ revision: string; command: string }>;
  /** craft verify --env: what the environment runs now; null when nothing was released yet */
  current(ctx: ReleaseContext, env: string): Promise<LiveVersion | null>;
}

/** Any installed connector plugin, told apart by manifest.category. */
export type ConnectorPlugin = CodeSourceConnector | ReleaseProviderConnector;
export const isCodeSource = (p: ConnectorPlugin): p is CodeSourceConnector =>
  p.manifest.category === 'code_source';
export const isReleaseProvider = (p: ConnectorPlugin): p is ReleaseProviderConnector =>
  p.manifest.category === 'release';

// ---------- API ----------

const Json = Type.Record(Type.String(), Type.Unknown());

export const VerifyConnectorRequest = Type.Object({
  plugin_id: Type.String({ minLength: 1, maxLength: 100 }),
  config: Json,
  credential: Json,
});
export type VerifyConnectorRequest = Static<typeof VerifyConnectorRequest>;

export const CreateConnectorRequest = Type.Object({
  plugin_id: Type.String({ minLength: 1, maxLength: 100 }),
  name: Type.String({ minLength: 1, maxLength: 60 }),
  config: Json,
  credential: Json,
});
export type CreateConnectorRequest = Static<typeof CreateConnectorRequest>;

export const ConnectorRow = Type.Object({
  id: Type.String(),
  plugin_id: Type.String(),
  name: Type.String(),
  category: Type.String(),
  config: Json,
  /** last characters of the credential, e.g. •••• 91d0; the secret itself never comes back */
  credential_hint: Type.String(),
  status: Type.String(),
  rev: Type.Integer(),
});
export type ConnectorRow = Static<typeof ConnectorRow>;

export const AttachReposRequest = Type.Object({
  connector_id: Type.String({ format: 'uuid' }),
  remote_ids: Type.Array(Type.String({ minLength: 1, maxLength: 200 }), {
    minItems: 1,
    maxItems: 100,
  }),
});

/** What the probe guessed (06 §10.3 item 3); fields the user changed are listed in manual_overrides. */
export const RepoSettings = Type.Object({
  default_branch: Type.String(),
  package_manager: Type.Union([
    Type.Literal('pnpm'),
    Type.Literal('npm'),
    Type.Literal('yarn'),
    Type.Null(),
  ]),
  build_command: Type.Union([Type.String(), Type.Null()]),
  test_command: Type.Union([Type.String(), Type.Null()]),
  typecheck_command: Type.Union([Type.String(), Type.Null()]),
  dist_dir: Type.Union([Type.String(), Type.Null()]),
  verify_strategy: Type.Union([
    Type.Literal('browser_dist_replace'),
    Type.Literal('test_suite'),
    Type.Literal('service_api_probe'),
  ]),
  asset_url_patterns: Type.Array(Type.String()),
});
export type RepoSettings = Static<typeof RepoSettings>;

export const UpdateRepoRequest = Type.Object({
  access_mode: Type.Optional(Type.Union([Type.Literal('read_only'), Type.Literal('read_write')])),
  project_id: Type.Optional(Type.String({ format: 'uuid' })),
  /** manual overrides; null clears an override back to the probe's guess */
  settings: Type.Optional(Type.Partial(Type.Object(RepoSettings.properties))),
  reset_overrides: Type.Optional(Type.Array(Type.String())),
  rev: Type.Optional(Type.Integer()),
});
export type UpdateRepoRequest = Static<typeof UpdateRepoRequest>;

export interface RepoRow {
  id: string;
  connector_id: string | null;
  remote_repo_id: string | null;
  path: string;
  clone_url: string;
  access_mode: 'read_only' | 'read_write';
  project_id: string | null;
  settings: RepoSettings | null;
  detected: RepoSettings | null;
  manual_overrides: string[];
  probe: { state: 'pending' | 'done' | 'failed'; at: string | null; notes: string[] };
  rev: number;
}

/** GET /v1/plugins item: an installed connector plugin and the schemas its drawer renders. */
export interface PluginInfo {
  id: string;
  name: string;
  category: ConnectorCategory;
  icon: string | null;
  config_schema: TSchema;
  auth_schema: TSchema;
  personal_auth_schema: TSchema | null;
}

export interface ProjectRow {
  id: string;
  name: string;
  slug: string;
}

/** GET /v1/workspaces/:ws/flows/:id: a flow and its node runs (trial build, ticket rounds). */
export interface FlowStatus {
  id: string;
  kind: string;
  status: string;
  nodes: {
    key: string;
    status: string;
    attempt_no: number;
    output: unknown;
    error: string | null;
  }[];
}

// ---------- credential envelopes for executors (06 §2.10) ----------

/**
 * A secret sealed to one executor key: the secret is encrypted with a fresh data key (AES-256-GCM),
 * and the data key with an X25519 shared secret between an ephemeral key and the executor's key.
 */
export const CredentialEnvelope = Type.Object({
  secret_id: Type.String(),
  key_fingerprint: Type.String(),
  ephemeral_public_key: Type.String(),
  wrapped_key: Type.String(),
  ciphertext: Type.String(),
});
export type CredentialEnvelope = Static<typeof CredentialEnvelope>;
