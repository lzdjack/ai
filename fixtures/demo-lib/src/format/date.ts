import type { Locale } from '../index';

const pad = (n: number) => String(n).padStart(2, '0');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 按北京时间显示日期：zh-CN 为 2026-11-27，en-US 为 Nov 27, 2026 */
export function formatDate(iso: string, locale: Locale = 'zh-CN'): string {
  const d = beijing(iso);
  if (locale === 'en-US') return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** 日期加时分：2026-11-27 09:30 */
export function formatDateTime(iso: string, locale: Locale = 'zh-CN'): string {
  const d = beijing(iso);
  return `${formatDate(iso, locale)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function beijing(iso: string): Date {
  return new Date(new Date(iso).getTime() + 8 * 3600_000);
}
