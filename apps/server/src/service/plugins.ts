// Built-in plugin provider for connectors (docs/06 §12, §13): loaded by module name from config, never
// imported statically by core code. M1 ships connector-gitlab; the market adds more later.
import type { CodeSourceConnector } from '@cloudcraft/core-protocol';
import { ApiFailure } from './errors.ts';

export type ConnectorRegistry = Map<string, CodeSourceConnector>;

export async function loadConnectors(specifiers: string[]): Promise<ConnectorRegistry> {
  const reg: ConnectorRegistry = new Map();
  for (const s of specifiers) {
    const mod = (await import(s)) as { default?: CodeSourceConnector };
    const p = mod.default;
    if (!p?.manifest?.id || typeof p.verify !== 'function')
      throw new Error(`${s} is not a connector plugin (CodeSourceConnector as default export)`);
    reg.set(p.manifest.id, p);
  }
  return reg;
}

export function connectorOf(reg: ConnectorRegistry, pluginId: string): CodeSourceConnector {
  const p = reg.get(pluginId);
  if (!p) throw new ApiFailure(400, 'connector.plugin_not_installed', { plugin_id: pluginId });
  return p;
}
