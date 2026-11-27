// Per-round internal network + relay container (docs/06 §5.3 item 3, Docker Desktop / OrbStack).
// The code container joins only the --internal network, whose single other member is the relay;
// the relay also sits on the default bridge so it can reach the host services it forwards to.
// On Linux servers the host mounts a per-round Unix socket instead (not implemented yet).
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';

export const RELAY_ALIAS = 'cc-relay';
const RELAY_PORT = 8080;

export interface RoundNetwork {
  /** pass as RunOptions.network for the code container */
  network: string;
  /** base URL of the relay as seen from inside the code container */
  relayUrl: string;
  /** 256-bit token the code container must send on every request (round_ephemeral_token) */
  token: string;
  close(): void;
}

function docker(args: string[]): string {
  const r = spawnSync('docker', args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`docker ${args[0]} failed: ${r.stderr.trim()}`);
  return r.stdout.trim();
}

/**
 * @param routes path prefix → host port, e.g. { '/llm': 5001, '/tools': 5002 }; the host services
 *   listen on 127.0.0.1 and are reached through host.docker.internal.
 */
export async function openRoundNetwork(opts: {
  image: string;
  /** directory holding relay.mjs (infra/sandbox) */
  contextDir: string;
  routes: Record<string, number>;
  /** the round token, when the caller already handed it to the host services; random otherwise */
  token?: string;
  labels?: Record<string, string>;
}): Promise<RoundNetwork> {
  const id = crypto.randomBytes(6).toString('hex');
  const network = `cc-round-${id}`;
  const relay = `cc-relay-${id}`;
  const token = opts.token ?? crypto.randomBytes(32).toString('hex');
  const routes = Object.entries(opts.routes)
    .map(([prefix, port]) => `${prefix}=http://host.docker.internal:${port}`)
    .join(',');

  const close = () => {
    spawnSync('docker', ['rm', '-f', relay], { stdio: 'ignore' });
    spawnSync('docker', ['network', 'rm', network], { stdio: 'ignore' });
  };
  try {
    docker([
      'network',
      'create',
      '--internal',
      ...Object.entries(opts.labels ?? {}).map(([k, v]) => `--label=${k}=${v}`),
      network,
    ]);
    docker([
      'run',
      '-d',
      '--rm',
      '--name',
      relay,
      '--network=bridge',
      '--add-host=host.docker.internal:host-gateway',
      '--user=1000:1000',
      '--cap-drop=ALL',
      '--security-opt=no-new-privileges',
      '--read-only',
      '--memory=128m',
      '--pids-limit=64',
      ...Object.entries(opts.labels ?? {}).map(([k, v]) => `--label=${k}=${v}`),
      `--volume=${path.join(opts.contextDir, 'relay.mjs')}:/relay.mjs:ro`,
      '--env',
      `RELAY_TOKEN=${token}`,
      '--env',
      `RELAY_ROUTES=${routes}`,
      opts.image,
      'node',
      '/relay.mjs',
    ]);
    docker(['network', 'connect', '--alias', RELAY_ALIAS, network, relay]);
    for (let i = 0; i < 50; i++) {
      if (docker(['logs', relay]).includes('listening')) break;
      await new Promise((r) => setTimeout(r, 100));
    }
  } catch (e) {
    close();
    throw e;
  }
  return { network, relayUrl: `http://${RELAY_ALIAS}:${RELAY_PORT}`, token, close };
}
