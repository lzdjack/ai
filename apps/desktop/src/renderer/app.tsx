// The workbench screen (01 §3): shell + ticket list + conversation + info rail, on the ticket API
// (P5b): the list groups by what waits on whom, the conversation shows each round's delivery card
// with the before / after screenshots, and the assignee approves or sends back from the review row.
// ?demo=1 keeps U1's sample data of the approved design for side-by-side checks.
import type { EnvironmentRow, Me, TicketDetail, TicketSummary } from '@cloudcraft/core-protocol';
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
  NewTicketDialog,
  RejectDialog,
  TicketList,
  TicketRail,
  TicketView,
  groupTickets,
  ticketVM,
  type NewTicketProject,
  type TicketDetailVM,
  type TicketGroupVM,
  type TicketTab,
} from '@cloudcraft/workbench-ui';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onboardingCalls, ticketCalls } from './api.ts';
import after from './demo/evidence-after.png';
import before from './demo/evidence-before.png';
import demo from './demo/workbench.json';

const IMAGES: Record<string, string> = {
  'evidence-before.png': before,
  'evidence-after.png': after,
};
const POLL_MS = 4000;

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

function Shell(p: {
  me: Me;
  forcedTheme: boolean;
  status: StatusPillProps[];
  chatBadge?: number;
  releaseBadge?: number;
  children: ReactNode;
}) {
  const t = useT();
  const [active, setActive] = useState<DockKind>('chat');
  return (
    <AppShell
      topBar={
        <TopBar
          status={p.status}
          user={{ name: p.me.display_name, initial: p.me.display_name.slice(0, 1) }}
        />
      }
      dock={
        <Dock
          active={active}
          onSelect={setActive}
          top={[{ kind: 'ai', label: t('shell.dock.ai') }]}
          modules={[
            { kind: 'chat', label: t('shell.dock.chat'), badge: p.chatBadge },
            { kind: 'release', label: t('shell.dock.release'), badge: p.releaseBadge },
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
      {p.forcedTheme ? null : <ThemeFollower />}
      {p.children}
    </AppShell>
  );
}

function DemoApp({ forcedTheme, me }: { forcedTheme: boolean; me: Me }) {
  const t = useT();
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [selected, setSelected] = useState('TK-20871');
  const [tab, setTab] = useState<TicketTab>('chat');
  const [ticket] = useState(demoTicket);
  return (
    <Shell
      me={me}
      forcedTheme={forcedTheme}
      status={[
        { text: t('shell.status.bots_online', { count: demo.bots_online }), bot: true },
        ...demo.sources,
      ]}
      chatBadge={demo.badges.chat}
      releaseBadge={demo.badges.release}
    >
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
    </Shell>
  );
}

export function App({ forcedTheme, me }: { forcedTheme: boolean; me: Me }) {
  if (new URLSearchParams(location.search).get('demo') === '1')
    return <DemoApp forcedTheme={forcedTheme} me={me} />;
  return <LiveApp forcedTheme={forcedTheme} me={me} />;
}

function LiveApp({ forcedTheme, me }: { forcedTheme: boolean; me: Me }) {
  const t = useT();
  const ws = me.workspaces[0]!.id;
  const calls = useMemo(() => ticketCalls(ws), [ws]);
  const setup = useMemo(() => onboardingCalls(ws), [ws]);
  const [items, setItems] = useState<TicketSummary[]>([]);
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [images, setImages] = useState<Record<string, string>>({});
  const [projects, setProjects] = useState<NewTicketProject[]>([]);
  const [envs, setEnvs] = useState<Record<string, EnvironmentRow | null>>({});
  const [tab, setTab] = useState<TicketTab>('chat');
  const [dialog, setDialog] = useState<'reject' | 'new' | null>(null);
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(() => calls.list().then(setItems), [calls]);
  const loadDetail = useCallback(
    (id: string) => calls.detail(id).then((d) => (d.id === id ? setDetail(d) : undefined)),
    [calls],
  );
  // the list and the open ticket follow the server (polling; the change stream joins later)
  useEffect(() => {
    void loadList();
    const id = setInterval(() => void loadList(), POLL_MS);
    return () => clearInterval(id);
  }, [loadList]);
  useEffect(() => {
    if (!selected) return setDetail(null);
    void loadDetail(selected);
    const id = setInterval(() => void loadDetail(selected), POLL_MS);
    return () => clearInterval(id);
  }, [selected, loadDetail]);
  const { groups, total } = useMemo(() => groupTickets(items, scope, t), [items, scope, t]);
  // open the first ticket of the list
  useEffect(() => {
    const first = groups[0]?.items[0]?.id ?? null;
    if (!selected || !items.some((x) => x.id === selected)) setSelected(first);
  }, [groups, items, selected]);
  // projects (for the new-ticket dialog and the meta line) and their test environments
  useEffect(() => {
    void Promise.all([setup.projects(), setup.repos()]).then(async ([ps, rs]) => {
      const e: Record<string, EnvironmentRow | null> = {};
      for (const x of ps)
        e[x.id] = (await setup.environments(x.id)).find((v) => v.env_tier === 'test_gate') ?? null;
      setEnvs(e);
      setProjects(
        ps.map((x) => ({
          id: x.id,
          name: x.name,
          ready: rs.some((r) => r.project_id === x.id && r.access_mode === 'read_write'),
          env: e[x.id] ? { name: e[x.id]!.name, url: e[x.id]!.entry_url } : null,
        })),
      );
    });
  }, [setup]);
  // evidence images of the open ticket, fetched once each
  useEffect(() => {
    const ids = (detail?.rounds ?? [])
      .flatMap((r) => r.delivery?.screenshots ?? [])
      .map((s) => s.evidence_id)
      .filter((x): x is string => !!x && !images[x]);
    for (const id of ids)
      calls.evidence(id).then(
        (url) => setImages((m) => ({ ...m, [id]: url })),
        () => {},
      );
  }, [detail, images, calls]);

  const vm = detail
    ? ticketVM(detail, {
        projectName: projects.find((p) => p.id === detail.project_id)?.name ?? '',
        env: envs[detail.project_id] ?? null,
        images,
        t,
      })
    : null;
  const current = detail?.rounds[detail.rounds.length - 1];
  const review = async (body: {
    decision: 'approve' | 'reject';
    comment?: string;
    reject_category?: string;
  }) => {
    if (!detail || !current?.delivery) return;
    const d = await calls.review(detail.id, {
      ...body,
      round_no: current.round_no,
      delivery_digest: current.delivery.delivery_digest,
      review_rev: current.review_rev,
    } as Parameters<typeof calls.review>[1]);
    setDetail(d);
    void loadList();
  };
  const waiting = items.filter(
    (x) => x.is_assignee && (x.status === 'in_review' || x.status === 'needs_help'),
  ).length;

  return (
    <Shell me={me} forcedTheme={forcedTheme} status={[]} chatBadge={waiting || undefined}>
      <TicketList
        groups={groups}
        total={total}
        scope={scope}
        onScope={setScope}
        selected={selected ?? ''}
        onSelect={setSelected}
        onNew={() => setDialog('new')}
      />
      {vm ? (
        <>
          <TicketView
            ticket={vm}
            tab={tab}
            onTab={setTab}
            busy={busy}
            onApprove={async () => {
              setBusy(true);
              try {
                await review({ decision: 'approve' });
              } finally {
                setBusy(false);
              }
            }}
            onReject={() => setDialog('reject')}
          />
          <TicketRail rail={vm.rail} />
        </>
      ) : (
        <main className="glass panel col grow wb-main wb-empty">
          <div className="f15 w7">{t(items.length ? 'wb.empty.pick' : 'wb.empty.none')}</div>
          <div className="f13 t3" style={{ marginTop: 6 }}>
            {t('wb.empty.hint')}
          </div>
        </main>
      )}
      {dialog === 'reject' && detail && current?.delivery ? (
        <RejectDialog
          ticketNo={detail.no}
          round={current.round_no}
          sha={current.delivery.repos[0]?.head_sha.slice(0, 7) ?? ''}
          onClose={() => setDialog(null)}
          onSubmit={async (v) => {
            await review({
              decision: 'reject',
              comment: v.comment,
              ...(v.category ? { reject_category: v.category } : {}),
            });
            setDialog(null);
          }}
        />
      ) : null}
      {dialog === 'new' ? (
        <NewTicketDialog
          projects={projects}
          me={me.display_name}
          onClose={() => setDialog(null)}
          onSubmit={async (v) => {
            const created = await calls.create(v.project_id, {
              title: v.title,
              body: v.body,
              priority: v.priority,
            });
            setDialog(null);
            await loadList();
            setSelected(created.id);
          }}
        />
      ) : null}
    </Shell>
  );
}
