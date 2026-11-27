// Pi extension loaded inside the sandbox container (`pi -e /opt/cc-pi/extension.ts`).
// Registers the host-backed tools; each call is forwarded through the relay to the host tool
// server, which validates it and decides the result. Nothing here holds a credential: the round
// token in bridge.json is only good for this round's relay.
// Pi resolves `typebox` to its own copy, so this file may import only typebox, node built-ins and
// sibling files.
import fs from 'node:fs';
import path from 'node:path';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { SUBMIT_DELIVERY, SubmitDeliveryParams } from './delivery.ts';

interface Bridge {
  url: string;
  token: string;
}

function bridge(): Bridge {
  const dir = process.env.PI_CODING_AGENT_DIR ?? '';
  return JSON.parse(fs.readFileSync(path.join(dir, 'bridge.json'), 'utf8')) as Bridge;
}

async function callHost(tool: string, params: unknown, signal?: AbortSignal): Promise<string> {
  const b = bridge();
  const res = await fetch(`${b.url}/tools/${tool}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${b.token}` },
    body: JSON.stringify(params),
    signal,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`host rejected ${tool} (${res.status}): ${text}`);
  return text;
}

export default function ccTools(pi: ExtensionAPI): void {
  pi.registerTool({
    name: SUBMIT_DELIVERY,
    label: 'Submit delivery',
    description:
      'Call exactly once when the fix is done and verified. The host commits your changes, ' +
      'replays your repro tests before and after the fix, and reports the verdict.',
    parameters: SubmitDeliveryParams,
    async execute(_toolCallId, params, signal) {
      const text = await callHost(SUBMIT_DELIVERY, params, signal);
      return { content: [{ type: 'text', text }], details: {} };
    },
  });
}
