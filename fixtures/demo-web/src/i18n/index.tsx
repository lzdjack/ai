import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Locale } from '@demo/lib';
import { enUS } from './en-US';
import { zhCN, type MessageKey } from './zh-CN';

export const MESSAGES: Record<Locale, Record<MessageKey, string>> = { 'zh-CN': zhCN, 'en-US': enUS };

export function translate(locale: Locale, key: MessageKey, vars: Record<string, string | number> = {}): string {
  return MESSAGES[locale][key].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

const Ctx = createContext<{ locale: Locale; setLocale: (l: Locale) => void }>({
  locale: 'zh-CN',
  setLocale: () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>('zh-CN');
  return <Ctx.Provider value={{ locale, setLocale }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const { locale, setLocale } = useContext(Ctx);
  return { locale, setLocale, t: (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars) };
}
