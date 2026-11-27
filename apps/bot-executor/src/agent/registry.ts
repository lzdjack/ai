// PluginRegistry for engines (docs/06 §11.4): the executor's only place that loads an engine, by the
// module name in its config. Core code never imports a plugin statically.
import { AdapterCapabilities, type AgentRuntimePlugin } from '@cloudcraft/core-protocol';
import Value from 'typebox/value';

export async function loadRuntime(specifier: string): Promise<AgentRuntimePlugin> {
  const mod = (await import(specifier)) as { default?: AgentRuntimePlugin };
  const p = mod.default;
  if (
    !p ||
    typeof p.start !== 'function' ||
    typeof p.manifest?.id !== 'string' ||
    !Value.Check(AdapterCapabilities, p.manifest.capabilities)
  )
    throw new Error(`${specifier} is not an engine plugin (AgentRuntimePlugin as default export)`);
  return p;
}
