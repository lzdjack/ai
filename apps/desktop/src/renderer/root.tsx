// Signed out: sign-in / sign-up (01 §9). Signed in: the workbench (01 §3). The first-run wizard
// (01 §11) comes in between with the rest of P3b.
import type { Me } from '@cloudcraft/core-protocol';
import { AuthScreen } from '@cloudcraft/workbench-ui';
import { useEffect, useState } from 'react';
import { api } from './api.ts';
import { App } from './app.tsx';

export function Root({ forcedTheme }: { forcedTheme: boolean }) {
  const [me, setMe] = useState<Me | null | 'loading'>(api.hasSession() ? 'loading' : null);
  useEffect(() => {
    if (me === 'loading') api.me().then(setMe, () => setMe(null));
  }, [me]);
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
  return <App forcedTheme={forcedTheme} me={me} />;
}
