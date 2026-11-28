// Light / dark (01 §6): only tokens change, through html.dark (tokens/theme.css). Follows the system
// unless the user picked one; the picker lives in "My account" (01 §10.14).
import { useCallback, useEffect, useState } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';
const KEY = 'cc.theme';

const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && systemDark());
  document.documentElement.classList.toggle('dark', dark);
}

export function useTheme() {
  const [pref, setPrefState] = useState<ThemePref>(readPref);
  useEffect(() => {
    applyTheme(pref);
    if (pref !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => applyTheme('system');
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [pref]);
  const setPref = useCallback((p: ThemePref) => {
    try {
      localStorage.setItem(KEY, p);
    } catch {
      // private mode: keep it for this session only
    }
    setPrefState(p);
  }, []);
  return { pref, setPref };
}
