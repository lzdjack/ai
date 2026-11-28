// Signed out: sign-in / sign-up (01 §9). Signed in to a workspace with no repository yet: the first-run
// wizard (01 §11), which can be left for later ("稍后再填") and reopened with ?onboard=1. Otherwise the
// workbench (01 §3).
import type { Me } from '@cloudcraft/core-protocol';
import { AuthScreen, OnboardingScreen } from '@cloudcraft/workbench-ui';
import { useEffect, useMemo, useState } from 'react';
import { api, onboardingCalls } from './api.ts';
import { App } from './app.tsx';

const laterKey = (ws: string) => `cc.onboarding.later.${ws}`;

function leftForLater(ws: string) {
  try {
    return localStorage.getItem(laterKey(ws)) === '1';
  } catch {
    return false;
  }
}

export function Root({ forcedTheme }: { forcedTheme: boolean }) {
  const [me, setMe] = useState<Me | null | 'loading'>(api.hasSession() ? 'loading' : null);
  const [wizard, setWizard] = useState<boolean | null>(null);
  useEffect(() => {
    if (me === 'loading') api.me().then(setMe, () => setMe(null));
  }, [me]);
  const ws = me && me !== 'loading' ? me.workspaces[0]?.id : undefined;
  const calls = useMemo(() => (ws ? onboardingCalls(ws) : null), [ws]);
  useEffect(() => {
    if (!ws || !calls) return;
    if (new URLSearchParams(location.search).get('onboard') === '1') return setWizard(true);
    if (leftForLater(ws)) return setWizard(false);
    calls.repos().then(
      (rs) => setWizard(rs.length === 0),
      () => setWizard(false),
    );
  }, [ws, calls]);
  if (me === 'loading') return null;
  if (!me)
    return (
      <AuthScreen
        initialMode={
          new URLSearchParams(location.search).get('auth') === 'register' ? 'register' : 'login'
        }
        calls={{
          login: async (e, p, r) => {
            await api.login(e, p, r);
            setMe('loading');
          },
          requestCode: api.requestCode,
          register: async (v) => {
            await api.register(v);
            setMe('loading');
          },
        }}
      />
    );
  if (ws && wizard === null) return null;
  if (ws && calls && wizard)
    return (
      <OnboardingScreen
        calls={calls}
        onDone={() => {
          try {
            localStorage.setItem(laterKey(ws), '1');
          } catch {
            // storage blocked: the wizard comes back next time, which is harmless
          }
          setWizard(false);
        }}
      />
    );
  return <App forcedTheme={forcedTheme} me={me} />;
}
