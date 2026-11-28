import '@cloudcraft/ui-kit/styles.css';
import '@cloudcraft/workbench-ui/styles.css';
import { I18nProvider, applyTheme, type ThemePref } from '@cloudcraft/ui-kit';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import messages from '../../../../i18n/zh-CN.json';
import { App } from './app.tsx';

// ?mode=light|dark forces a theme (side-by-side checks against the design renders); otherwise the
// user's choice or the system's
const mode = new URLSearchParams(location.search).get('mode');
if (mode === 'light' || mode === 'dark') applyTheme(mode as ThemePref);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider messages={messages} locale="zh-CN">
      <App forcedTheme={mode === 'light' || mode === 'dark'} />
    </I18nProvider>
  </StrictMode>,
);
