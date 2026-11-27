// Model proxy process: `pnpm llm-proxy`. The only process that reads the model API key.
import { loadConfig } from '@cloudcraft/config';
import { controlSocketPath, startLlmProxy } from './control.ts';

const c = loadConfig();
if (!c.CC_LLM_BASE_URL || !c.CC_LLM_MODEL || !c.CC_LLM_API_KEY) {
  console.error('[llm-proxy] CC_LLM_BASE_URL / CC_LLM_MODEL / CC_LLM_API_KEY are not set');
  process.exit(1);
}
const controlSocket = controlSocketPath(c.CC_DATA_DIR);
const p = await startLlmProxy({
  upstream: {
    api: c.CC_LLM_API ?? 'openai-responses',
    baseUrl: c.CC_LLM_BASE_URL,
    apiKey: c.CC_LLM_API_KEY,
    model: c.CC_LLM_MODEL,
  },
  port: c.CC_LLM_PROXY_PORT,
  controlSocket,
});
console.log(`[llm-proxy] model traffic on 127.0.0.1:${p.info.port}, control on ${controlSocket}`);
for (const sig of ['SIGINT', 'SIGTERM'] as const)
  process.once(sig, () => void p.close().then(() => process.exit(0)));
