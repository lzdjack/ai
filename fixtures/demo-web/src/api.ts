import type { Approval, NewApproval } from './types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
  const body = await res.json();
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status, body });
  return body as T;
}

export const api = {
  list: () => request<Approval[]>('/api/approvals'),
  get: (id: string) => request<Approval>(`/api/approvals/${id}`),
  create: (v: NewApproval) => request<Approval>('/api/approvals', { method: 'POST', body: JSON.stringify(v) }),
  withdraw: (id: string) => request<Approval>(`/api/approvals/${id}/withdraw`, { method: 'POST' }),
};
