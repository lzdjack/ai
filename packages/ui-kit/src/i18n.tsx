// UI text comes from i18n/zh-CN.json (ICU MessageFormat, docs/06 §13.6 item 9); never written in code.
import { IntlMessageFormat } from 'intl-messageformat';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

export type Messages = Record<string, string>;
export type Translate = (key: string, values?: Record<string, string | number>) => string;

const I18nContext = createContext<Translate>((key) => key);

export function createTranslate(messages: Messages, locale: string): Translate {
  const cache = new Map<string, IntlMessageFormat>();
  return (key, values) => {
    const src = messages[key];
    if (src === undefined) return key;
    let f = cache.get(key);
    if (!f) cache.set(key, (f = new IntlMessageFormat(src, locale)));
    return String(f.format(values));
  };
}

export function I18nProvider(p: { messages: Messages; locale: string; children: ReactNode }) {
  const t = useMemo(() => createTranslate(p.messages, p.locale), [p.messages, p.locale]);
  return <I18nContext.Provider value={t}>{p.children}</I18nContext.Provider>;
}

export const useT = () => useContext(I18nContext);
