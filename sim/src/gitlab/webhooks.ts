// 依据：GitLab 官方文档「Webhooks」——X-Gitlab-Event / X-Gitlab-Token 头，失败不重试（模拟从简）
import type { GitlabHook } from '../state.ts';

export interface Delivery {
  hook_id: number;
  url: string;
  event: string;
  status: number | null;
  error: string | null;
  at: string;
}

const EVENT_HEADER = { push: 'Push Hook', merge_request: 'Merge Request Hook' } as const;
const KEEP = 50;

export async function deliver(
  hook: GitlabHook,
  event: keyof typeof EVENT_HEADER,
  payload: object,
  log: Delivery[],
): Promise<void> {
  const record: Delivery = {
    hook_id: hook.id,
    url: hook.url,
    event,
    status: null,
    error: null,
    at: new Date().toISOString(),
  };
  try {
    const res = await fetch(hook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Gitlab-Event': EVENT_HEADER[event],
        ...(hook.token ? { 'X-Gitlab-Token': hook.token } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    record.status = res.status;
  } catch (e) {
    record.error = e instanceof Error ? e.message : String(e);
  }
  log.unshift(record);
  log.length = Math.min(log.length, KEEP);
}
