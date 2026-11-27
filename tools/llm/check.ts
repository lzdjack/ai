// pnpm llm:check：模型接入自检（docs/06 §11.1）。读 ~/.cloudcraft-dev/.env 的 CC_LLM_*，
// 发一条极短的请求，确认地址、协议、模型、密钥能用。输出里不出现密钥。
//   - 没填 CC_LLM_MODEL：列出服务端可用的模型
//   - 没填 CC_LLM_API：三种协议依次试，告诉你哪种能通
import { loadConfig } from '@cloudcraft/config';

type Api = 'openai-completions' | 'openai-responses' | 'anthropic-messages';
const APIS: Api[] = ['openai-completions', 'openai-responses', 'anthropic-messages'];

const c = loadConfig();
const missing = (['CC_LLM_BASE_URL', 'CC_LLM_API_KEY'] as const).filter((k) => !c[k]);
if (missing.length) {
  console.error(`✗ ~/.cloudcraft-dev/.env 里还没填：${missing.join('、')}`);
  process.exit(1);
}
const key = c.CC_LLM_API_KEY!;
const base = c.CC_LLM_BASE_URL!.replace(/\/+$/, '');
const hasV1 = /\/v1$/.test(base);
const redact = (s: string) => s.split(key).join('***');
// 中转站对鉴权头的要求不一：两种都带上
const headers = {
  'content-type': 'application/json',
  authorization: `Bearer ${key}`,
  'x-api-key': key,
  'anthropic-version': '2023-06-01',
};

async function call(url: string, body?: unknown): Promise<{ status: number; text: string }> {
  try {
    const r = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(60_000),
    });
    return { status: r.status, text: redact(await r.text()) };
  } catch (e) {
    return { status: 0, text: redact(String((e as Error).cause ?? e)) };
  }
}

/** OpenAI 兼容地址通常带 /v1，Anthropic 通常不带；两种写法都试 */
const urlsFor = (suffix: string) =>
  hasV1 ? [`${base}${suffix}`] : [`${base}/v1${suffix}`, `${base}${suffix}`];

if (!c.CC_LLM_MODEL) {
  for (const url of urlsFor('/models')) {
    const r = await call(url);
    if (r.status !== 200) continue;
    const ids = ((JSON.parse(r.text) as { data?: Array<{ id: string }> }).data ?? []).map(
      (m) => m.id,
    );
    console.log(`服务端可用的模型（${ids.length} 个）：\n  ${ids.slice(0, 50).join('\n  ')}`);
    console.log('\n挑一个填进 CC_LLM_MODEL，再跑一次 pnpm llm:check');
    process.exit(0);
  }
  console.error('✗ 还没填 CC_LLM_MODEL，且服务端不支持列出模型；请按中转站的说明填模型名');
  process.exit(1);
}
const model = c.CC_LLM_MODEL;
const prompt = 'Reply with exactly: OK';

/** 三种协议回复里我们只读文本，按最宽松的形状声明 */
interface Reply {
  choices?: Array<{ message?: { content?: unknown } }>;
  output_text?: unknown;
  output?: Array<{ type: string; content?: Array<{ text?: unknown }> }>;
  content?: Array<{ type: string; text?: unknown }>;
}

const requests: Record<Api, { suffix: string; body: unknown; reply: (j: Reply) => unknown }> = {
  'openai-completions': {
    suffix: '/chat/completions',
    body: { model, messages: [{ role: 'user', content: prompt }] },
    reply: (j) => j.choices?.[0]?.message?.content,
  },
  'openai-responses': {
    suffix: '/responses',
    body: { model, input: prompt },
    reply: (j) => j.output_text ?? j.output?.find((o) => o.type === 'message')?.content?.[0]?.text,
  },
  'anthropic-messages': {
    suffix: '/messages',
    body: { model, max_tokens: 16, messages: [{ role: 'user', content: prompt }] },
    reply: (j) => j.content?.find((b) => b.type === 'text')?.text,
  },
};

const ok: Array<{ api: Api; url: string }> = [];
for (const api of c.CC_LLM_API ? [c.CC_LLM_API] : APIS) {
  const { suffix, body, reply } = requests[api];
  let last = '';
  for (const url of urlsFor(suffix)) {
    const started = Date.now();
    const r = await call(url, body);
    let text: unknown;
    try {
      text = reply(JSON.parse(r.text) as Reply);
    } catch {
      text = undefined;
    }
    if (r.status === 200 && typeof text === 'string') {
      console.log(`✓ ${api}  ${url}  ${Date.now() - started}ms  回复：${text.trim().slice(0, 40)}`);
      ok.push({ api, url });
      last = '';
      break;
    }
    last = `HTTP ${r.status || '连不上'}  ${r.text.replace(/\s+/g, ' ').slice(0, 200)}`;
  }
  if (last) console.log(`✗ ${api}  ${last}`);
}

if (!ok.length) {
  console.error('\n都没通。常见原因：地址少了或多了 /v1、模型名不对、密钥不对、协议不对');
  process.exit(1);
}
const best = ok[0]!;
const suggestedBase = best.url.slice(0, -requests[best.api].suffix.length);
if (!c.CC_LLM_API || suggestedBase !== base) {
  console.log('\n建议 .env 这样写：');
  console.log(`  CC_LLM_API=${best.api}`);
  console.log(`  CC_LLM_BASE_URL=${suggestedBase}`);
}
