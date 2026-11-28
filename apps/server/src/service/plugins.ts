// Built-in plugin provider for connectors (docs/06 §12, §13): loaded by module name from config, never
// imported statically by core code. M1 ships connector-gitlab (code source) and connector-tita-apollo
// (release provider); the market adds more later. Plugins are told apart by manifest.category only.
import {
  isCodeSource,
  isReleaseProvider,
  type CodeSourceConnector,
  type ConnectorPlugin,
  type ReleaseProviderConnector,
} from '@cloudcraft/core-protocol';
import { ApiFailure } from './errors.ts';

export type ConnectorRegistry = Map<string, ConnectorPlugin>;

export async function loadConnectors(specifiers: string[]): Promise<ConnectorRegistry> {
  const reg: ConnectorRegistry = new Map();
  for (const s of specifiers) {
    const mod = (await import(s)) as { default?: ConnectorPlugin };
    const p = mod.default;
    if (!p?.manifest?.id || typeof p.verify !== 'function')
      throw new Error(`${s} is not a connector plugin (a connector as default export)`);
    reg.set(p.manifest.id, p);
  }
  return reg;
}

export function connectorOf(reg: ConnectorRegistry, pluginId: string): ConnectorPlugin {
  const p = reg.get(pluginId);
  if (!p) throw new ApiFailure(400, 'connector.plugin_not_installed', { plugin_id: pluginId });
  return p;
}

export function codeSourceOf(reg: ConnectorRegistry, pluginId: string): CodeSourceConnector {
  const p = connectorOf(reg, pluginId);
  if (!isCodeSource(p))
    throw new ApiFailure(400, 'connector.not_code_source', { plugin_id: pluginId });
  return p;
}

export function releaseProviderOf(
  reg: ConnectorRegistry,
  pluginId: string,
): ReleaseProviderConnector {
  const p = connectorOf(reg, pluginId);
  if (!isReleaseProvider(p))
    throw new ApiFailure(400, 'connector.not_release_provider', { plugin_id: pluginId });
  return p;
}
