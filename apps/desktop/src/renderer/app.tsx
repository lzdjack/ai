// The workbench screen (01 §3): shell + ticket list + conversation + info rail. U1 renders the sample
// data of the approved design; P2 / P4 bring the session and the ticket API.
import {
  AppShell,
  Dock,
  TopBar,
  useT,
  useTheme,
  type DockKind,
  type StatusPillProps,
} from '@cloudcraft/ui-kit';
import {
  TicketList,
  TicketRail,
  TicketView,
  type TicketDetailVM,
  type TicketGroupVM,
  type TicketTab,
} from '@cloudcraft/workbench-ui';
import { useState } from 'react';
import after from './demo/evidence-after.png';
import before from './demo/evidence-before.png';
import demo from './demo/workbench.json';

const IMAGES: Record<string, string> = {
  'evidence-before.png': before,
  'evidence-after.png': after,
};

function demoTicket(): TicketDetailVM {
  const t = structuredClone(demo.ticket) as unknown as TicketDetailVM;
  for (const f of t.flow)
    if (f.kind === 'bot' && f.delivery) {
      f.delivery.before.image = IMAGES[f.delivery.before.image] ?? '';
      f.delivery.after.image = IMAGES[f.delivery.after.image] ?? '';
    }
  return t;
}

function ThemeFollower() {
  useTheme();
  return null;
}

export function App({ forcedTheme }: { forcedTheme: boolean }) {
  const t = useT();
  const [active, setActive] = useState<DockKind>('chat');
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [selected, setSelected] = useState('TK-20871');
  const [tab, setTab] = useState<TicketTab>('chat');
  const [ticket] = useState(demoTicket);
  const status: StatusPillProps[] = [
    { text: t('shell.status.bots_online', { count: demo.bots_online }), bot: true },
    ...demo.sources,
  ];
  return (
    <AppShell
      topBar={<TopBar status={status} user={demo.user} />}
      dock={
        <Dock
          active={active}
          onSelect={setActive}
          top={[{ kind: 'ai', label: t('shell.dock.ai') }]}
          modules={[
            { kind: 'chat', label: t('shell.dock.chat'), badge: demo.badges.chat },
            { kind: 'release', label: t('shell.dock.release'), badge: demo.badges.release },
            { kind: 'rollback', label: t('shell.dock.rollback') },
            { kind: 'skills', label: t('shell.dock.skills') },
          ]}
          bottom={[
            { kind: 'market', label: t('shell.dock.market') },
            { kind: 'settings', label: t('shell.dock.settings') },
          ]}
        />
      }
    >
      {forcedTheme ? null : <ThemeFollower />}
      <TicketList
        groups={demo.groups as TicketGroupVM[]}
        total={demo.total}
        scope={scope}
        onScope={setScope}
        selected={selected}
        onSelect={setSelected}
        onNew={() => {}}
      />
      <TicketView ticket={ticket} tab={tab} onTab={setTab} />
      <TicketRail rail={ticket.rail} />
    </AppShell>
  );
}
