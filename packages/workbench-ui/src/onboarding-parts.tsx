// Shared by the wizard and its drawers: the API calls the app passes in, trial-build state and the
// small marks (plugin icon, repository tile).
import type {
  ConnectorRow,
  EnvironmentRow,
  FlowStatus,
  PluginInfo,
  ProjectRow,
  RemoteRepo,
  RepoRow,
  UpdateRepoRequest,
  VerifyResult,
} from '@cloudcraft/core-protocol';

export interface OnboardingCalls {
  plugins(): Promise<PluginInfo[]>;
  connectors(): Promise<ConnectorRow[]>;
  verify(v: {
    plugin_id: string;
    config: Record<string, unknown>;
    credential: Record<string, unknown>;
  }): Promise<VerifyResult>;
  createConnector(v: {
    plugin_id: string;
    name: string;
    config: Record<string, unknown>;
    credential: Record<string, unknown>;
  }): Promise<ConnectorRow>;
  remoteRepos(connectorId: string, q: string): Promise<{ items: RemoteRepo[]; has_more: boolean }>;
  attach(connectorId: string, remoteIds: string[]): Promise<RepoRow[]>;
  repos(): Promise<RepoRow[]>;
  updateRepo(id: string, body: UpdateRepoRequest): Promise<RepoRow>;
  projects(): Promise<ProjectRow[]>;
  environments(projectId: string): Promise<EnvironmentRow[]>;
  createEnvironment(
    projectId: string,
    v: { env_code: string; name: string; env_tier: string; entry_url: string },
  ): Promise<EnvironmentRow>;
  trialBuild(projectId: string): Promise<{ flow_id: string }>;
  flow(id: string): Promise<FlowStatus>;
}

/** A trial build started from the wizard (tune drawer or step 4), polled until it ends. */
export interface BuildState {
  flowId: string;
  status: 'running' | 'done' | 'failed';
  startedAt: number;
  ms?: number;
  error?: string;
}

export const errText = (e: unknown) => (e as { message?: string }).message ?? String(e);

/** Plugin mark: the SVG the plugin ships, or its first letter. */
export function Mark(p: { plugin?: PluginInfo; name: string; size: number; className?: string }) {
  return (
    <span
      className={`ob-mark ${p.className ?? ''}`}
      style={{ width: p.size, height: p.size, fontSize: Math.round(p.size * 0.38) }}
    >
      {p.plugin?.icon ? (
        <img src={`data:image/svg+xml;utf8,${encodeURIComponent(p.plugin.icon)}`} alt="" />
      ) : (
        p.name.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

export const repoName = (r: { path: string }) => r.path.split('/').pop() ?? r.path;

/** Short label and colour of a repository tile (the design's "OKR" / "API" squares). */
export function repoTile(path: string) {
  const parts = repoName({ path }).split(/[-_.]/).filter(Boolean);
  const label = (parts[parts.length - 1] ?? path).slice(0, 3).toUpperCase();
  let h = 0;
  for (const ch of path) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { label, tone: `ob-tone-${h % 4}` };
}
