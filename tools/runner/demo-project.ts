// The demo team's project as the drills need it (tickets:try, release:try), reused when it exists:
// the simulated GitLab connected, demo-lib and demo-web writable in one project (probed on the way),
// a test environment on the simulator's environment site.
import { DEMO_NAMESPACE, DEMO_REPOS } from '../fixtures/lib.ts';

type Json = Record<string, unknown>;
export type Call = (method: string, p: string, body?: unknown) => Promise<Json>;

export async function setupDemoProject(o: {
  call: Call;
  ws: string;
  simBase: string;
  botToken: string;
  testEnvUrl: string;
}) {
  const { call, ws, simBase } = o;
  const conns = (await call('GET', `${ws}/connectors`)).items as Json[];
  const conn =
    conns.find(
      (x) => x.plugin_id === 'connector-gitlab' && (x.config as Json).base_url === simBase,
    ) ??
    (await call('POST', `${ws}/connectors`, {
      plugin_id: 'connector-gitlab',
      name: '模拟 GitLab',
      config: { base_url: simBase },
      credential: { token: o.botToken },
    }));
  const remote = (
    (await call('GET', `${ws}/connectors/${conn.id}/remote-repos?q=demo`)).items as Json[]
  ).filter((r) => DEMO_REPOS.some((n) => r.path === `${DEMO_NAMESPACE}/${n}`));
  const attached = (
    (await call('POST', `${ws}/repos/batch-attach`, {
      connector_id: conn.id,
      remote_ids: remote.map((r) => r.remote_id),
    })) as { items: Json[] }
  ).items;
  const web = attached.find((r) => String(r.path).endsWith('demo-web'))!;
  const lib = attached.find((r) => String(r.path).endsWith('demo-lib'))!;
  const webRw = web.project_id
    ? web
    : await call('PATCH', `${ws}/repos/${web.id}`, { access_mode: 'read_write' });
  const project = webRw.project_id as string;
  if (!lib.project_id)
    await call('PATCH', `${ws}/repos/${lib.id}`, {
      access_mode: 'read_write',
      project_id: project,
    });
  await call('POST', `${ws}/projects/${project}/environments`, {
    env_code: 'test',
    name: '测试环境',
    env_tier: 'test_gate',
    entry_url: o.testEnvUrl,
  }).catch(() => null);
  return { project, connectorId: conn.id as string, webRepoId: web.id as string };
}
