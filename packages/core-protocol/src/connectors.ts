// Connector plugins and repositories (docs/06 §2.4, §6.1, §10.3). A code-source connector only talks to
// its platform; the core never branches on which platform it is. Credentials reach a connector in
// memory for one call and are stored only as envelopes (06 §2.10).
import { Type, type Static, type TSchema } from 'typebox';

export type ConnectorCategory = 'code_source' | 'ticket_source' | 'release' | 'notify';

export interface ConnectorManifest {
  id: string;
  name: string;
  category: ConnectorCategory;
  /** JSON Schema of the non-secret settings (e.g. base URL); the drawer renders it */
  configSchema: TSchema;
  /** JSON Schema of the credential (never echoed back) */
  authSchema: TSchema;
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
}

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
