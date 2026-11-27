// Pi extension loaded inside the sandbox container (`pi -e /opt/cc-pi/extension.ts`).
// Registers the host tools listed in tools.json (written by the plugin from the node's allowed
// tools); each call is forwarded through the relay to the host tool server, which validates it and
// decides the result. Nothing here holds a credential: the round token in bridge.json is only good
// for this round's relay. This file may import only node built-ins (Pi loads it on its own).
import fs from 'node:fs';
import path from 'node:path';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

interface Bridge {
  url: string;
  token: string;
}
interface ToolDecl {
  name: string;
  label: string;
  description: string;
  parameters: Record<string, unknown>;
}

const dir = process.env.PI_CODING_AGENT_DIR ?? '';
const read = <T>(f: string) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as T;

async function callHost(tool: string, params: unknown, signal?: AbortSignal): Promise<string> {
  const b = read<Bridge>('bridge.json');
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
  for (const t of read<ToolDecl[]>('tools.json'))
    pi.registerTool({
      name: t.name,
      label: t.label,
      description: t.description,
      parameters: t.parameters as never,
      async execute(_toolCallId, params, signal) {
        const text = await callHost(t.name, params, signal);
        return { content: [{ type: 'text', text }], details: {} };
      },
    });
}
