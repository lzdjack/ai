// PC shell (01 §3, approved design PC-主界面): top bar 64px, icon-only Dock, three glass panels.
import type { ReactNode } from 'react';
import chatIcon from './assets/dock-chat.svg';
import releaseIcon from './assets/dock-release.svg';
import settingsIcon from './assets/dock-settings.svg';
import { useT } from './i18n.tsx';
import {
  BotIcon,
  DockAiIcon,
  DockMarketIcon,
  DockRollbackIcon,
  DockSkillsIcon,
  LogoIcon,
  SearchIcon,
  SparkleIcon,
} from './icons.tsx';
import { Avatar } from './primitives.tsx';

export function AppShell(p: { topBar: ReactNode; dock: ReactNode; children: ReactNode }) {
  return (
    <div className="root cc-shell">
      {p.topBar}
      <div className="cc-panels">{p.children}</div>
      {p.dock}
    </div>
  );
}

export interface StatusPillProps {
  text: string;
  /** dot colour token, e.g. var(--green); none for the Bot pill */
  dot?: string;
  warn?: boolean;
  bot?: boolean;
}

export function TopBar(p: { status: StatusPillProps[]; user: { name: string; initial: string } }) {
  const t = useT();
  return (
    <div className="row cc-topbar">
      <div className="row g8" style={{ width: 330 }}>
        <span className="cc-brand">
          <span className="cc-logo">
            <LogoIcon />
            <SparkleIcon className="spk" />
          </span>
          <span className="cc-brand-name">
            <b>{t('app.name')}</b>
            <em>{t('app.name_latin')}</em>
          </span>
        </span>
      </div>
      <div className="grow row" style={{ justifyContent: 'center' }}>
        <div className="row g8 cc-topsearch" role="search">
          <SearchIcon />
          <span className="f13 grow">{t('shell.search.placeholder')}</span>
          <span className="kbd">⌘F</span>
        </div>
      </div>
      <div className="row g8" style={{ width: 330, justifyContent: 'flex-end' }}>
        {p.status.map((s) => (
          <span key={s.text} className={`pill glass cc-status-pill${s.warn ? ' is-warn' : ''}`}>
            {s.bot ? <BotIcon /> : <span className="dot" style={{ background: s.dot }} />}
            {s.text}
          </span>
        ))}
        <Avatar name={p.user.name} label={p.user.initial} size={34} tone={6} fontSize={13} />
      </div>
    </div>
  );
}

export type DockKind = 'ai' | 'chat' | 'release' | 'rollback' | 'skills' | 'market' | 'settings';

const DOCK_ICON: Record<DockKind, () => ReactNode> = {
  ai: () => <DockAiIcon />,
  chat: () => <img src={chatIcon} alt="" />,
  release: () => <img src={releaseIcon} alt="" width={24} height={24} />,
  rollback: () => <DockRollbackIcon />,
  skills: () => <DockSkillsIcon />,
  market: () => <DockMarketIcon />,
  settings: () => <img src={settingsIcon} alt="" width={24} height={24} />,
};

export interface DockItemProps {
  kind: DockKind;
  label: string;
  badge?: number;
}

/** Top: the global AI, a separator, the work modules; bottom: plugin market and settings. */
export function Dock(p: {
  top: DockItemProps[];
  modules: DockItemProps[];
  bottom: DockItemProps[];
  active: DockKind;
  onSelect: (k: DockKind) => void;
}) {
  const t = useT();
  const item = (d: DockItemProps) => (
    <button
      key={d.kind}
      type="button"
      className={`cc-dock-item${p.active === d.kind ? ' is-on' : ''}`}
      aria-label={d.label}
      aria-current={p.active === d.kind ? 'page' : undefined}
      onClick={() => p.onSelect(d.kind)}
    >
      <span className={`cc-dock-ic is-${d.kind}`}>{DOCK_ICON[d.kind]()}</span>
      {d.badge ? <b>{d.badge}</b> : null}
    </button>
  );
  return (
    <nav className="glass cc-dock" aria-label={t('shell.dock.label')}>
      {p.top.map(item)}
      <span className="cc-dock-sep" />
      {p.modules.map(item)}
      <span className="grow" />
      {p.bottom.map(item)}
    </nav>
  );
}
