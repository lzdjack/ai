// Pilot release provider (docs/06 §7.4, 04 §3): artifacts to OSS, the environment switched by an
// Apollo config release, written with the acting person's own Apollo account (三段写回: read the
// current config → compute the new value as `tita release --local-config` would → write and publish).
// Runs only in the release executor. Only base URLs tell the real systems from the simulator.
//
// Assumption until §15 items 4 and 8 are measured: the config value is JSON with Version, CommitId
// and where the files are (Bucket, Prefix) — the real `tita release` writes resource URLs, integrity
// and <CommitId>; the upload key is the shared connector's credential (tita CLI's built-in key today).
import type {
  ArtifactFile,
  LiveVersion,
  ReleaseContext,
  ReleaseProviderConnector,
  VerifyResult,
} from '@cloudcraft/core-protocol';
import { Type } from 'typebox';

interface Config {
  apollo_url: string;
  oss_url: string;
}
interface Target {
  app_id: string;
  cluster?: string;
  namespace?: string;
  /** the Apollo item tita writes (package.json configFile) */
  config_key: string;
  oss_bucket: string;
  /** e.g. demo-web/release/ — the version is appended */
  oss_prefix: string;
}

const TIMEOUT = 15_000;
const trim = (u: unknown) => String(u).replace(/\/$/, '');
const cfg = (c: Record<string, unknown>) => c as unknown as Config;
const tgt = (t: Record<string, unknown>) => t as unknown as Target;

/** Portal form login with the person's account; returns the session cookie. */
async function login(config: Record<string, unknown>, personal: Record<string, unknown>) {
  const res = await fetch(`${trim(cfg(config).apollo_url)}/signin`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      username: String(personal.username ?? ''),
      password: String(personal.password ?? ''),
    }).toString(),
    redirect: 'manual',
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const cookie = res.headers.get('set-cookie')?.split(';')[0];
  if (res.status !== 302 || !cookie) throw new Error(`Apollo sign-in refused (${res.status})`);
  return cookie;
}

function nsPath(t: Target, env: string) {
  return `/apps/${encodeURIComponent(t.app_id)}/envs/${encodeURIComponent(env)}/clusters/${t.cluster ?? 'default'}/namespaces/${t.namespace ?? 'application'}`;
}

async function apollo(
  config: Record<string, unknown>,
  cookie: string,
  path: string,
  init: RequestInit = {},
) {
  const res = await fetch(`${trim(cfg(config).apollo_url)}${path}`, {
    ...init,
    headers: { cookie, 'content-type': 'application/json', ...init.headers },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`Apollo ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json() as Promise<unknown>;
}

const failed = (t0: number, error: string): VerifyResult => ({
  ok: false,
  latency_ms: Date.now() - t0,
  identity: null,
  scopes: [],
  has_merge_perm: null,
  visible_repo_count: null,
  error_raw: error,
});

const connector: ReleaseProviderConnector = {
  manifest: {
    id: 'connector-tita-apollo',
    name: 'tita · Apollo',
    category: 'release',
    configSchema: Type.Object({
      apollo_url: Type.String({ pattern: '^https?://' }),
      oss_url: Type.String({ pattern: '^https?://' }),
    }),
    authSchema: Type.Object({ oss_access_key: Type.String({ minLength: 8 }) }),
    personalAuthSchema: Type.Object({
      username: Type.String({ minLength: 1 }),
      password: Type.String({ minLength: 1 }),
    }),
  },

  async verify(config) {
    const t0 = Date.now();
    try {
      // both systems answer (an unauthenticated read is refused, which still proves the address)
      for (const url of [`${trim(cfg(config).apollo_url)}/user`, `${trim(cfg(config).oss_url)}/`])
        await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
      return {
        ok: true,
        latency_ms: Date.now() - t0,
        identity: null,
        scopes: [],
        has_merge_perm: null,
        visible_repo_count: null,
      };
    } catch (e) {
      return failed(t0, (e as Error).message);
    }
  },

  async verifyPersonal(config, personal) {
    const t0 = Date.now();
    try {
      const cookie = await login(config, personal);
      const me = (await apollo(config, cookie, '/user')) as { userId: string; name?: string };
      return {
        ok: true,
        latency_ms: Date.now() - t0,
        identity: me.name ? `${me.name} (${me.userId})` : me.userId,
        scopes: [],
        has_merge_perm: null,
        visible_repo_count: null,
      };
    } catch (e) {
      return failed(t0, (e as Error).message);
    }
  },

  async publish(
    ctx: ReleaseContext,
    a: { version: string; commit: string; files: ArtifactFile[] },
  ) {
    const t = tgt(ctx.target);
    const prefix = `${t.oss_prefix.replace(/\/?$/, '/')}${a.version}/`;
    let uploaded = 0;
    let skipped = 0;
    for (const f of a.files) {
      const key = `${prefix}${f.path}`.split('/').map(encodeURIComponent).join('/');
      const res = await fetch(`${trim(cfg(ctx.config).oss_url)}/oss/${t.oss_bucket}/${key}`, {
        method: 'PUT',
        headers: {
          'content-type': 'application/octet-stream',
          'x-oss-access-key': String(ctx.credential.oss_access_key ?? ''),
        },
        body: new Uint8Array(f.data),
        signal: AbortSignal.timeout(TIMEOUT),
      });
      // same name already there: skipped, as tita build does (the version is in the path)
      if (res.status === 409) skipped += 1;
      else if (res.ok) uploaded += 1;
      else throw new Error(`OSS ${res.status} ${f.path}`);
    }
    return { location: { bucket: t.oss_bucket, prefix }, uploaded, skipped };
  },

  async release(ctx, r) {
    const t = tgt(ctx.target);
    const cookie = await login(ctx.config, ctx.personal);
    const ns = nsPath(t, r.env);
    // 1. read what is configured now (the other keys stay as they are)
    await apollo(ctx.config, cookie, ns);
    // 2. the new value, as `tita release --local-config` computes it
    const value = JSON.stringify({
      Version: r.version,
      CommitId: r.commit,
      Bucket: String(r.location.bucket),
      Prefix: String(r.location.prefix),
    });
    // 3. write back and publish with the person's account
    await apollo(ctx.config, cookie, `${ns}/item`, {
      method: 'PUT',
      body: JSON.stringify({ key: t.config_key, value }),
    });
    const rel = (await apollo(ctx.config, cookie, `${ns}/releases`, {
      method: 'POST',
      body: JSON.stringify({ releaseTitle: r.title, releaseComment: `CommitId ${r.commit}` }),
    })) as { id: number };
    return { revision: String(rel.id), command: `tita release --app ${t.app_id} --env ${r.env}` };
  },

  async current(ctx, env): Promise<LiveVersion | null> {
    const t = tgt(ctx.target);
    const cookie = await login(ctx.config, ctx.personal);
    const list = (await apollo(
      ctx.config,
      cookie,
      `/envs/${encodeURIComponent(env)}/apps/${encodeURIComponent(t.app_id)}/clusters/${t.cluster ?? 'default'}/namespaces/${t.namespace ?? 'application'}/releases/active?page=0&size=1`,
    )) as { id: number; configurations: string }[];
    const r = list[0];
    if (!r) return null;
    const raw = (JSON.parse(r.configurations) as Record<string, string>)[t.config_key];
    if (!raw) return null;
    const v = JSON.parse(raw) as { Version?: string; CommitId?: string };
    if (!v.Version || !v.CommitId) return null;
    return { version: v.Version, commit: v.CommitId, revision: String(r.id) };
  },
};

export default connector;
