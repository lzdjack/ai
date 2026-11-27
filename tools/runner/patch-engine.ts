// An engine plugin for drills that must not call a model (pnpm runner:browser): in the real round
// sandbox (internal network, relay, /work mounted) it applies the patches it is configured with and
// calls submit_delivery through the relay, the way an agent would. Loaded by the executor through
// CC_AGENT_RUNTIME like any engine (docs/06 §11.4); it only proves the host side, not an agent.
import type { AgentEvent, AgentRuntimePlugin } from '@cloudcraft/core-protocol';

interface PatchEngineConfig {
  /** repo → unified diff, applied with git apply under /work/<repo> */
  patches: Record<string, string>;
  /** submit_delivery parameters */
  delivery: unknown;
}

const b64 = (v: unknown) =>
  Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64');

const SCRIPT = `exec 2>&1; node -e '
const fs = require("fs"), cp = require("child_process");
const patches = JSON.parse(Buffer.from(process.env.CC_PATCHES, "base64").toString());
for (const [repo, p] of Object.entries(patches)) {
  fs.writeFileSync("/tmp/fix.patch", p);
  cp.execFileSync("git", ["-c", "safe.directory=*", "apply", "/tmp/fix.patch"], { cwd: "/work/" + repo, stdio: "inherit" });
}
fetch(process.env.CC_RELAY + "/tools/submit_delivery", {
  method: "POST",
  headers: { "content-type": "application/json", authorization: "Bearer " + process.env.CC_TOKEN },
  body: Buffer.from(process.env.CC_DELIVERY, "base64").toString(),
}).then(async (r) => { console.log("SUBMIT " + r.status + " " + (await r.text()).slice(0, 300)); process.exit(r.ok ? 0 : 1); });
'`;

const plugin: AgentRuntimePlugin = {
  manifest: {
    id: 'runtime-patch',
    name: 'Patch (drill)',
    version: '0',
    configSchema: {} as never,
    capabilities: {
      supportsMidRunSteer: false,
      supportsThinkingStream: false,
      supportsExactTokenCost: false,
      supportsCrossNodeResume: false,
      supportsContextHook: false,
    },
  },
  async start(ctx) {
    const cfg = ctx.config as unknown as PatchEngineConfig;
    const listeners = new Set<(e: AgentEvent) => void>();
    const emit = (e: AgentEvent) => listeners.forEach((l) => l(e));
    let kill: (() => void) | null = null;
    return {
      async run() {
        emit({ type: 'tool_start', tool: 'submit_delivery', summary: 'apply patches and submit' });
        const p = ctx.sandbox.start({
          command: SCRIPT,
          env: {
            CC_PATCHES: b64(cfg.patches),
            CC_DELIVERY: b64(cfg.delivery),
            CC_RELAY: ctx.relay.url,
            CC_TOKEN: ctx.relay.token,
          },
        });
        kill = p.kill;
        let out = '';
        p.stdout.on('data', (d) => (out += Buffer.from(d).toString()));
        const code = await p.exited;
        emit({ type: 'tool_end', tool: 'submit_delivery', is_error: code !== 0 });
        if (out.trim()) emit({ type: 'text', text: out.trim().slice(0, 500) });
        emit({ type: 'turn_end' });
        return code === 0 ? { reason: 'settled' } : { reason: 'crashed', error: out.slice(-500) };
      },
      async abort() {
        kill?.();
      },
      on(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      async close() {},
    };
  },
};

export default plugin;
