import type { Locale } from '../index';

const SYMBOL: Record<Locale, string> = { 'zh-CN': '¥', 'en-US': 'CNY ' };

/** 金额（元）→ 带货币符号、千分位、两位小数的文字，如 ¥1,234.50；负数为 -¥1,234.50 */
export function formatAmount(value: number, locale: Locale = 'zh-CN'): string {
  const sign = value < 0 ? '-' : '';
  const [int = '0', dec = '00'] = (Math.round(Math.abs(value) * 100) / 100).toFixed(2).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${SYMBOL[locale]}${grouped}.${dec}`;
}
