// From the ticket API (core-protocol DTOs) to the workbench view models (types.ts). Pure functions:
// the app passes the translator and what it fetched (evidence images as object URLs).
import type {
  DeliveryCard,
  EnvironmentRow,
  TicketDetail,
  TicketStatus,
  TicketSummary,
} from '@cloudcraft/core-protocol';
import type { Translate } from '@cloudcraft/ui-kit';
import type {
  DeliveryVM,
  FlowItemVM,
  StatusTone,
  TicketDetailVM,
  TicketGroupKey,
  TicketGroupVM,
  TicketRowVM,
} from './types.ts';

/** Which group a ticket falls in, by what is waiting on whom (01 §3.3); each ticket in exactly one. */
const GROUP: Record<TicketStatus, TicketGroupKey> = {
  needs_help: 'need_action',
  in_review: 'waiting_you',
  fixing: 'bot_fixing',
  pending: 'queued',
  rework: 'queued',
  approved: 'releasing',
  done: 'done',
};
/** "需要处理" first — the user's decision of 2026-11-27, as 01 §3.3 writes it. */
const ORDER: TicketGroupKey[] = [
  'need_action',
  'waiting_you',
  'bot_asking',
  'bot_fixing',
  'queued',
  'releasing',
  'platform_confirm',
  'done',
];
export const TONE: Record<TicketStatus, StatusTone> = {
  needs_help: 'red',
  in_review: 'blue',
  fixing: 'teal',
  pending: 'gray',
  rework: 'gray',
  approved: 'green',
  done: 'green',
};

/** 14:05 today, 昨天, or 11-26 */
export function shortTime(iso: string, t: Translate, now = new Date()) {
  const d = new Date(iso);
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  if (diff === 0) return hm;
  if (diff === 1) return t('wb.time.yesterday', { hm });
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** A reason as one short line: engine errors can be multi-line stack traces. */
const firstLine = (s: string) => {
  const l = s.split('\n')[0]!.trim();
  return l.length > 80 ? `${l.slice(0, 80)}…` : l;
};

export function groupTickets(
  items: TicketSummary[],
  scope: 'mine' | 'all',
  t: Translate,
): { groups: TicketGroupVM[]; total: number } {
  const shown = items.filter(
    (x) => (scope === 'all' || x.is_assignee) && (scope === 'all' || x.status !== 'done'),
  );
  const by = new Map<TicketGroupKey, TicketRowVM[]>();
  for (const x of shown) {
    const key = GROUP[x.status] ?? 'queued';
    const row: TicketRowVM = {
      id: x.id,
      title: x.title,
      reporter: { name: x.reporter_name ?? x.no, label: (x.reporter_name ?? x.no).slice(0, 2) },
      status: TONE[x.status] ?? 'gray',
      note:
        x.status === 'needs_help' && x.help_reason
          ? `${x.no} · ${firstLine(x.help_reason)}`
          : `${x.no} · ${t(`wb.status.${x.status}`, { round: x.current_round })}`,
      ...(x.status === 'needs_help' ? { noteTone: 'red' as const } : {}),
      time: shortTime(x.updated_at, t),
    };
    by.set(key, [...(by.get(key) ?? []), row]);
  }
  return {
    groups: ORDER.filter((k) => by.has(k)).map((k) => ({ key: k, items: by.get(k)! })),
    total: shown.length,
  };
}

const minutesBetween = (a: string, b: string) =>
  Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60_000));

function deliveryVM(
  c: DeliveryCard,
  previousReview: TicketDetail['rounds'][number]['review'],
  images: Record<string, string>,
  t: Translate,
): DeliveryVM {
  const before = c.screenshots.filter((x) => x.name.startsWith('base-'));
  const after = c.screenshots.filter((x) => x.name.startsWith('head-'));
  const img = (x?: { evidence_id?: string | null }) =>
    (x?.evidence_id && images[x.evidence_id]) || '';
  const files = c.repos.reduce(
    (s, r) => ({ count: s.count + r.files.length, add: s.add + r.added, del: s.del + r.deleted }),
    { count: 0, add: 0, del: 0 },
  );
  return {
    round: c.round_no,
    by: c.model ? `Bot · ${c.model}` : 'Bot',
    at: shortTime(c.delivered_at, t),
    rootCause: c.root_cause,
    ...(previousReview?.result === 'rejected'
      ? { response: c.summary, responseHandled: true }
      : {}),
    before: { image: img(before[before.length - 1]), duration: '', seen: true },
    after: { image: img(after[after.length - 1]), duration: '', seen: true },
    verifiedOn: c.repro.browser
      ? t('wb.delivery.verified_browser')
      : t('wb.delivery.verified_tests'),
    checks: c.checks.map((k) => ({ label: t(`wb.check.${k.key}`), untested: !k.ok })),
    files,
    mr: c.repos.map((r) => `${r.branch} · ${r.head_sha.slice(0, 7)}`).join(t('ob.list_sep')),
    skills: [t('wb.delivery.risk', { level: c.risk_level })],
  };
}

export function ticketVM(
  d: TicketDetail,
  o: {
    projectName: string;
    env: EnvironmentRow | null;
    images: Record<string, string>;
    t: Translate;
  },
): TicketDetailVM {
  const { t } = o;
  const flow: FlowItemVM[] = [];
  const last = d.rounds[d.rounds.length - 1];
  d.rounds.forEach((r, i) => {
    const prev = d.rounds[i - 1];
    flow.push({
      kind: 'divider',
      text: t('wb.flow.round', {
        round: r.round_no,
        at: shortTime(r.started_at, t),
        cause: r.cause,
      }),
    });
    if (prev?.review?.result === 'rejected')
      flow.push({
        kind: 'user',
        text: prev.review.comment ?? '',
        note: t('wb.flow.rejected_note', {
          round: prev.round_no,
          at: shortTime(prev.review.at, t),
        }),
      });
    const delivered = !!r.delivery;
    const reviewable =
      r === last && d.status === 'in_review' && d.is_assignee && r.status === 'delivered';
    flow.push({
      kind: 'bot',
      steps: [t('wb.step.prepare'), t('wb.step.fix'), t('wb.step.verify')],
      minutes: r.delivery ? minutesBetween(r.started_at, r.delivery.delivered_at) : 0,
      ...(delivered
        ? { delivery: deliveryVM(r.delivery!, prev?.review ?? null, o.images, t) }
        : {}),
      ...(reviewable ? { review: { sha: r.delivery!.repos[0]?.head_sha.slice(0, 7) ?? '' } } : {}),
    });
    // a stopped round: why, as a line under its steps (the steps row only shows what passed)
    if (r.status === 'needs_help')
      flow.push({
        kind: 'divider',
        text: t('wb.step.needs_help', { reason: firstLine(r.reason ?? '') }),
      });
    if (r.review?.result === 'approved')
      flow.push({
        kind: 'divider',
        text: t('wb.flow.approved', { at: shortTime(r.review.at, t) }),
      });
  });
  const card = last?.delivery ?? null;
  const timeline: TicketDetailVM['rail']['timeline'] = [
    {
      tone: 'green',
      title: t('wb.rail.created'),
      sub: d.rounds[0] ? shortTime(d.rounds[0].started_at, t) : '',
    },
    ...d.rounds.flatMap((r) => {
      const xs: TicketDetailVM['rail']['timeline'] = [];
      if (r.review)
        xs.push({
          tone: r.review.result === 'approved' ? 'green' : 'red',
          title: t(`wb.rail.round_${r.review.result}`, { round: r.round_no }),
          sub: r.review.comment ? `“${r.review.comment.slice(0, 40)}”` : shortTime(r.review.at, t),
        });
      return xs;
    }),
  ];
  if (last && !last.review)
    timeline.push({
      tone: TONE[d.status],
      title: t(`wb.rail.now.${d.status}`, { round: last.round_no }),
      sub: card ? shortTime(card.delivered_at, t) : shortTime(last.started_at, t),
      current: true,
    });
  return {
    id: d.no,
    title: d.title,
    priority: d.priority,
    metaAfter: t('wb.meta.manual', { project: o.projectName }),
    state: {
      tone: TONE[d.status],
      text: t(`wb.status.${d.status}`, { round: d.current_round }),
    },
    counts: {
      code: card ? card.repos.reduce((n, r) => n + r.files.length, 0) : 0,
      evidence: card?.screenshots.length ?? 0,
    },
    extraTabs: [],
    flow,
    rail: {
      timeline,
      env: {
        test: o.env ? o.env.entry_url.replace(/^https?:\/\//, '') : t('wb.rail.none'),
        prod: t('wb.rail.none'),
        tester: t('wb.rail.none'),
      },
      progress: {
        codeReviewWaiting: d.status === 'in_review',
        ...(d.status === 'approved' || d.status === 'done'
          ? { codeReview: t('wb.rail.code_review_passed') }
          : {}),
        noSource: true,
        release: t(d.status === 'approved' ? 'wb.rail.release_ready' : 'wb.rail.not_started'),
        platform: t('wb.rail.platform_none'),
      },
    },
  };
}
