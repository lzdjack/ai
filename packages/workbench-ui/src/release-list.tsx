// Dock「发布」(01 §10.10、§12.2～§12.5, docs/02「两个入口一份内容」; designs PC-发布, PC-发正式, PC-发布-失败, PC-空状态):
// the releases of every ticket in one list — in progress, waiting for you, finished — and the detail
// header that names the ticket and leads back to it. The detail body is the release tab's own panel.
import type { ReleaseList as ReleaseListDTO, ReleaseRow } from '@cloudcraft/core-protocol';
import { DELIVERY_STEPS } from '@cloudcraft/core-protocol';
import {
  Avatar,
  BoxIcon,
  RocketIcon,
  ScrollArea,
  Seg,
  useT,
  type Translate,
} from '@cloudcraft/ui-kit';
import type { ReactNode } from 'react';
import { policyText, type ReleaseVM } from './release-map.ts';
import { shortTime } from './ticket-map.ts';

export type ReleaseGroupKey = ReleaseRow['group'];

export interface ReleaseRowVM {
  key: string;
  title: string;
  person: string;
  status: 'teal' | 'red' | 'orange' | 'green' | 'gray' | 'blue';
  note: string;
  noteTone?: 'orange' | 'red';
  time?: string;
  /** a failure not looked at yet */
  alert?: boolean;
  /** 0–100 while it runs */
  progress?: number;
}

const ORDER: ReleaseGroupKey[] = ['running', 'waiting', 'done'];
const DOT: Record<ReleaseRowVM['status'], string> = {
  blue: 'var(--blue)',
  orange: 'var(--orange)',
  teal: 'var(--teal)',
  green: 'var(--green)',
  red: 'var(--red)',
  gray: 'var(--text-3)',
};
const STEP_NAMES = {
  test: ['merge_test', 'build', 'release_test', 'verify', 'notify_tester'],
  production: ['merge_main', 'build', 'release_prod', 'verify', 'notify'],
} as const;

function elapsed(iso: string, t: Translate, now: Date) {
  const m = Math.max(1, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
  return m < 60 ? t('rel.list.minutes', { m }) : t('rel.list.hours', { h: Math.floor(m / 60) });
}

/** One row of the Dock list: what it is, where it stands, and whether that is the caller's to do. */
export function releaseRowVM(
  x: ReleaseRow,
  people: Record<string, string>,
  t: Translate,
  now = new Date(),
): ReleaseRowVM {
  const who = (id: string | null) => (id ? (people[id] ?? '') : '') || t('rel.someone');
  const env = x.environment_name ?? t(x.stage === 'test' ? 'rel.env.test' : 'rel.env.prod');
  const step = (i: number | null) => t(`rel.step.${STEP_NAMES[x.stage][i ?? 0]}`);
  const mineNow = x.group === 'waiting';
  const out = (
    status: ReleaseRowVM['status'],
    note: string,
    extra: Partial<ReleaseRowVM> = {},
  ): ReleaseRowVM => ({
    key: x.key,
    title: t('rel.list.row', { no: x.ticket_no, env }),
    person: who(x.person_id ?? x.assignee_id),
    status,
    note,
    ...(mineNow ? { noteTone: 'orange' as const } : {}),
    ...extra,
  });
  const merge = step(0);
  switch (x.state) {
    case 'before':
      return out('orange', t('rel.list.before'));
    case 'merge_review':
      return out(
        'orange',
        mineNow
          ? t('rel.list.review_you', { step: merge })
          : t('rel.list.review_wait', { who: policyText(x.reviewers ?? undefined, people, t) }),
      );
    case 'releasing': {
      const repo = x.repo?.split('/').pop() ?? '';
      return out(
        'teal',
        [t('rel.list.doing', { step: step(x.step) }), [repo, x.version].filter(Boolean).join(' ')]
          .filter(Boolean)
          .join(' · '),
        {
          time: elapsed(x.at, t, now),
          progress: Math.round((x.steps_done / DELIVERY_STEPS[x.stage].length) * 100),
        },
      );
    }
    case 'failed':
      return out('red', t('rel.pill.failed', { step: step(x.step) }), {
        noteTone: 'red',
        alert: true,
      });
    case 'pending_retest':
      return out(
        'orange',
        mineNow ? t('rel.list.retest_you') : t('rel.list.retest_wait', { who: who(x.tester_id) }),
      );
    case 'main_request':
      return out('orange', t('rel.list.main_request'));
    case 'release_ready':
      return out('orange', mineNow ? t('rel.list.release_you') : t('rel.list.release_wait'));
    case 'retest_passed':
      return out('green', t('rel.list.retest_passed', { who: who(x.tester_id) }));
    case 'effective':
      return out(
        'green',
        t('rel.list.effective', { version: x.version ?? '', at: shortTime(x.at, t, now) }),
      );
    case 'retest_rejected':
      return out('red', t('rel.list.retest_rejected', { who: who(x.tester_id) }));
    case 'review_rejected':
      return out('red', t('rel.list.review_rejected'));
    default:
      return out('gray', t('rel.pill.cancelled'));
  }
}

export function groupReleases(
  list: ReleaseListDTO,
  scope: 'mine' | 'all',
  t: Translate,
  now = new Date(),
) {
  const shown = list.items.filter((x) => scope === 'all' || x.mine);
  const groups = ORDER.map((key) => ({
    key,
    items: shown.filter((x) => x.group === key).map((x) => releaseRowVM(x, list.people, t, now)),
  })).filter((g) => g.items.length);
  return { groups, total: shown.length, rows: shown };
}

export function ReleaseList(p: {
  groups: { key: ReleaseGroupKey; items: ReleaseRowVM[] }[];
  total: number;
  scope: 'mine' | 'all';
  onScope: (s: 'mine' | 'all') => void;
  selected?: string;
  onSelect: (key: string) => void;
}) {
  const t = useT();
  return (
    <section className="glass panel col wb-list">
      <div className="row g8" style={{ padding: '0 8px 2px' }}>
        <span className="f18 w7">{t('rel.list.title')}</span>
        <span className="f13 t3 grow">{p.total}</span>
        <Seg
          size="xs"
          value={p.scope}
          onChange={p.onScope}
          items={[
            { key: 'mine', label: t('wb.list.mine') },
            { key: 'all', label: t('wb.list.all') },
          ]}
        />
      </div>
      {p.total ? (
        <ScrollArea className="grow">
          {p.groups.map((g) => (
            <div key={g.key}>
              <div className="wb-group">
                {t(`rel.group.${g.key}`)}
                <span>{g.items.length}</span>
              </div>
              {g.items.map((r) => {
                const on = p.selected === r.key;
                return (
                  <div
                    key={r.key}
                    className={`wb-row${on ? ' is-on' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-current={on ? 'true' : undefined}
                    onClick={() => p.onSelect(r.key)}
                    onKeyDown={(e) => e.key === 'Enter' && p.onSelect(r.key)}
                  >
                    <span className="wb-row-av">
                      <Avatar name={r.person} label={r.person.slice(0, 2)} size={34} />
                      <span className="wb-row-dot" style={{ background: DOT[r.status] }} />
                    </span>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="row g6">
                        <span className="wb-row-title ell grow">{r.title}</span>
                        {r.time ? <span className="wb-row-time">{r.time}</span> : null}
                        {r.alert && !on ? (
                          <span className="wb-unread" style={{ background: 'var(--red)' }} />
                        ) : null}
                      </div>
                      <div className="row g6" style={{ marginTop: 3 }}>
                        <span className={`wb-row-note ell${r.noteTone ? ` is-${r.noteTone}` : ''}`}>
                          {r.note}
                        </span>
                      </div>
                      {r.progress !== undefined ? (
                        <span className="wb-progress">
                          <i style={{ width: `${r.progress}%` }} />
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </ScrollArea>
      ) : (
        <div className="col g10 wb-rel-ph">
          <span />
          <span />
          <span className="is-short" />
        </div>
      )}
    </section>
  );
}

/** The detail's header in the Dock: which ticket, which round, which environment — and the way back. */
export function ReleaseDetailHead(p: {
  vm: ReleaseVM;
  ticketNo: string;
  ticketTitle: string;
  ticketMeta: string;
  onOpenTicket: () => void;
}) {
  const t = useT();
  const { vm } = p;
  return (
    <header className="wb-head">
      <div className="row g12">
        <span className={`wb-icbox wb-rel-icon ${vm.stage === 'test' ? 'is-orange' : 'is-blue'}`}>
          {vm.stage === 'test' ? (
            <BoxIcon width={20} height={20} />
          ) : (
            <RocketIcon width={20} height={20} />
          )}
        </span>
        <div className="col grow" style={{ minWidth: 0 }}>
          <h1 className="ell">
            {p.ticketNo} {vm.title}
          </h1>
          <div className="f12 t3" style={{ marginTop: 2 }}>
            {vm.meta}
          </div>
        </div>
        <span
          className={`pill p-${vm.pill.tone}${vm.pill.tone === 'teal' ? ' wb-rel-pill is-teal' : ''}`}
          style={{ flex: 'none' }}
        >
          {vm.pill.text}
        </span>
      </div>
      <div className="row g10 wb-rel-ticket">
        <span className="f13 w6 ell">{p.ticketTitle}</span>
        <span className="f12 t3" style={{ flex: 'none' }}>
          {p.ticketMeta}
        </span>
        <span className="grow" />
        <span
          className="f13 w6 wb-link"
          role="button"
          tabIndex={0}
          style={{ flex: 'none' }}
          onClick={p.onOpenTicket}
          onKeyDown={(e) => e.key === 'Enter' && p.onOpenTicket()}
        >
          {t('rel.open_ticket')}
        </span>
      </div>
    </header>
  );
}

/** 01 §10.10「发布 · 还没有发布」: before the first approved round. */
export function ReleaseEmpty(): ReactNode {
  const t = useT();
  return (
    <main className="glass panel col grow wb-main wb-rel-empty">
      <div className="col" style={{ maxWidth: 520 }}>
        <span className="wb-icbox wb-rel-empty-ic">
          <RocketIcon width={24} height={24} />
        </span>
        <div className="wb-rel-empty-h">{t('rel.empty.title')}</div>
        <div className="f13 t2" style={{ marginTop: 6 }}>
          {t('rel.empty.sub')}
        </div>
        <div className="row g6" style={{ marginTop: 14 }}>
          {(['approved', 'test', 'retest', 'prod'] as const).map((k, i) => (
            <span key={k} className="row g6">
              {i ? <span className="t3 f12">→</span> : null}
              <span className="wb-rel-chip">{t(`rel.empty.${k}`)}</span>
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}
