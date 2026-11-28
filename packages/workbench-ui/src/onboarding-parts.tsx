// Shared by the wizard and its drawers: the API calls the app passes in, trial-build state and the
// small marks (plugin icon, repository tile).
import type {
  ConnectorRow,
  CreateEnvAccountRequest,
  EnvAccountRow,
  EnvironmentRow,
  FlowStatus,
  HealthCheckResponse,
  PluginInfo,
  ProjectRow,
  RemoteBranch,
  RemoteRepo,
  RepoRow,
  UpdateConnectorRequest,
  UpdateEnvAccountRequest,
  UpdateRepoRequest,
  VerifyResult,
} from '@cloudcraft/core-protocol';
import { ChevronLeftIcon, SparkleOutlineIcon, useT } from '@cloudcraft/ui-kit';
import type { ReactNode } from 'react';

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
  updateConnector(
    id: string,
    body: UpdateConnectorRequest,
  ): Promise<ConnectorRow & { verify?: VerifyResult }>;
  deleteConnector(id: string): Promise<unknown>;
  remoteRepos(connectorId: string, q: string): Promise<{ items: RemoteRepo[]; has_more: boolean }>;
  attach(connectorId: string, remoteIds: string[]): Promise<RepoRow[]>;
  repos(): Promise<RepoRow[]>;
  updateRepo(id: string, body: UpdateRepoRequest): Promise<RepoRow>;
  branches(repoId: string, q?: string): Promise<RemoteBranch[]>;
  projects(): Promise<ProjectRow[]>;
  environments(projectId: string): Promise<EnvironmentRow[]>;
  createEnvironment(
    projectId: string,
    v: { env_code: string; name: string; env_tier: string; entry_url: string },
  ): Promise<EnvironmentRow>;
  envAccounts(projectId: string): Promise<EnvAccountRow[]>;
  createEnvAccount(
    projectId: string,
    envId: string,
    body: CreateEnvAccountRequest,
  ): Promise<{ account: EnvAccountRow; flow_id: string }>;
  /** 保存前试登录: the result is the env_login node's output of this flow */
  tryEnvAccount(
    projectId: string,
    envId: string,
    body: CreateEnvAccountRequest,
  ): Promise<{ flow_id: string }>;
  updateEnvAccount(
    projectId: string,
    id: string,
    body: UpdateEnvAccountRequest,
  ): Promise<{ account: EnvAccountRow; flow_id: string | null }>;
  deleteEnvAccount(projectId: string, id: string): Promise<unknown>;
  healthCheck(): Promise<HealthCheckResponse>;
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

/** Polls a flow every 2 s until it is no longer running (or the signal aborts). */
export async function waitFlow(
  calls: Pick<OnboardingCalls, 'flow'>,
  id: string,
  signal?: AbortSignal,
): Promise<FlowStatus | null> {
  for (;;) {
    if (signal?.aborted) return null;
    try {
      const f = await calls.flow(id);
      if (f.status !== 'running' && f.status !== 'pending') return f;
    } catch {
      // try again on the next tick
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

export const STEPS = ['s1', 's2', 's3', 's4'] as const;

export function Head(p: { step: number; ask: string }) {
  const t = useT();
  const s = STEPS[p.step];
  return (
    <div className="row g10">
      <div className="grow">
        <div className="ob-eyebrow">{t(`ob.${s}.eyebrow`)}</div>
        <div className="ob-h1">{t(`ob.${s}.h1`)}</div>
        <div className="f13 t2" style={{ marginTop: 5 }}>
          {t(`ob.${s}.lead`)}
        </div>
      </div>
      <span className="ob-chip" title={t('ob.ask_ai.soon')}>
        <SparkleOutlineIcon />
        {p.ask}
      </span>
    </div>
  );
}

export function Footer(p: { children: ReactNode }) {
  return <div className="ob-ff">{p.children}</div>;
}

export const BackButton = (p: { onClick: () => void }) => (
  <button type="button" className="ob-bigb ob-sec" onClick={p.onClick}>
    <ChevronLeftIcon />
    {useT()('ob.back')}
  </button>
);

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
