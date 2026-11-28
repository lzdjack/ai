// Server-side text (mail, notifications, error messages) from the same i18n/zh-CN.json as the clients
// (docs/06 §13.6 item 9). Error messages: key `error.<code>`.
import fs from 'node:fs';
import path from 'node:path';
import { IntlMessageFormat } from 'intl-messageformat';

const FILE = path.resolve(import.meta.dirname, '../../../../i18n/zh-CN.json');
const messages = JSON.parse(fs.readFileSync(FILE, 'utf8')) as Record<string, string>;
const cache = new Map<string, IntlMessageFormat>();

export function tr(key: string, values?: Record<string, string | number>): string {
  const src = messages[key];
  if (src === undefined) return key;
  let f = cache.get(key);
  if (!f) cache.set(key, (f = new IntlMessageFormat(src, 'zh-CN')));
  return String(f.format(values));
}

export const hasText = (key: string) => key in messages;
