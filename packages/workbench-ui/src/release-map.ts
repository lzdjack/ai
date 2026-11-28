// From the delivery read model (core-protocol DeliveryView) to the release tab's view model (01 §12.2,
// §12.3, §12.5). Pure: what is shown is computed from the flow's node runs, MRs, release tasks and test
// records on every read; nothing here decides what the caller may do — `can` does.
import {
  DELIVERY_STEPS,
  type ActorPolicyView,
  type DeliveryNodeView,
  type DeliveryView,
  type PersonalAccountRow,
  type ReleaseStage,
  type ReleaseStepView,
  type ReleaseTaskView,
  type TicketDetail,
} from '@cloudcraft/core-protocol';
import type { Translate } from '@cloudcraft/ui-kit';
import { shortTime } from './ticket-map.ts';

export type StepTone = 'ok' | 'run' | 'err' | 'wait' | 'you';
export type TagTone = 'blue' | 'green' | 'orange' | 'red' | 'teal' | 'gray';

export interface ReleaseVM {
  stage: 'test' | 'production';
  title: string;
  meta: string;
  history: number;
  pill: { tone: TagTone; text: string };
  envs: {
    name: string;
    on: boolean;
    tag: { tone: TagTone; text: string };
    from: string;
    /** the new version, or a hint like 打包后读出 */
    to?: { text: string; mono: boolean; struck?: boolean };
    note: string;
  }[];
  steps: { name: string; tone: StepTone; sub: string }[];
  pkg:
    | {
        kind: 'rows';
        title: string;
        ref: string;
        rows: { tone: 'ok' | 'blue'; title: string; sub: string }[];
      }
    | { kind: 'failure'; title: string; lines: { text: string; err?: boolean }[]; copy: string };
  side:
    | {
        kind: 'tester';
        hint?: string;
        tester: { id: string | null; name: string; sub: string };
        /** before the release starts the tester can be changed */
        pick?: { options: { id: string; name: string }[] };
        start?: { label: string; account?: string; who: string; enabled: boolean };
        entry?: { url: string };
        note?: string;
      }
    | {
        kind: 'review';
        waiting: string;
        /** who: the avatar's name */
        reviewer: { name: string; who: string; sub: string };
        actions?: { account?: string };
        note: string;
        head: string;
      }
    | { kind: 'retry'; tester: { name: string; sub: string }; label: string; note: string }
    | { kind: 'notify'; names: string; who: string; note: string };
  table: {
    note: string;
    rows: { stage: string; what: string; time: string; result: { tone: TagTone; text: string } }[];
  };
  rail: {
    records: {
      tone: TagTone;
      tag: string;
      version: string;
      who: string;
      comment?: string;
      /** the caller is this version's tester and it waits on them */
      decide?: string;
    }[];
    highlightRecords: boolean;
    gates: { label: string; ok: boolean }[];
    mainRequest?: { label: string; note: string };
    prod: { enabled: boolean; account?: string; who: string };
    highlightProd: boolean;
    log: { ts: string; text: string }[];
  };
  /** node key to retry from */
  retryKey: string | null;
  /** the MR the caller reviews (its head is what they approve) */
  reviewHead: string | null;
}

const hm = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const hms = (iso: string) => {
  const d = new Date(iso);
  return `${hm(iso)}:${String(d.getSeconds()).padStart(2, '0')}`;
};
const sha7 = (s: string | null | undefined) => (s ? s.slice(0, 7) : '');

/** 「tita release --app x --env TEST」 → 「tita release」; 「test · pnpm build」 → 「pnpm build」 */
const shortCmd = (c: string | null | undefined) =>
  c ? c.split(' · ').pop()!.split(' ').slice(0, 2).join(' ') : '';

function took(t: Translate, a: string | null, b: string | null) {
  if (!a || !b) return '';
  const s = Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 1000));
  return s < 60 ? t('rel.took_s', { s }) : t('rel.took_ms', { m: Math.floor(s / 60), s: s % 60 });
}

function groupTone(nodes: DeliveryNodeView[]): StepTone {
  if (nodes.some((n) => n.status === 'failed')) return 'err';
  if (nodes.some((n) => n.status === 'waiting_human')) return 'you';
  if (nodes.length && nodes.every((n) => n.status === 'done')) return 'ok';
  if (nodes.some((n) => n.status === 'running' || n.status === 'done')) return 'run';
  return 'wait';
}

/** Names of a policy, as the settings write it: 修复人, 任何人, or the people it names. */
export function policyText(
  p: ActorPolicyView | undefined,
  people: Record<string, string>,
  t: Translate,
) {
  if (!p) return '';
  if (p.type === 'users')
    return (p.users ?? []).map((u) => people[u] ?? u).join(t('ob.list_sep')) || t('rel.nobody');
  return t(`rel.policy.${p.type}`);
}

/** The first line of a step error that a person can act on (engine errors can be long). */
const errLine = (s: string | null) => {
  const l = (s ?? '').split('\n')[0]!.trim();
  return l.length > 60 ? `${l.slice(0, 60)}…` : l;
};

export function releaseVM(
  d: DeliveryView,
  o: {
    ticket: TicketDetail;
    me: string;
    accounts: PersonalAccountRow[];
    members: { id: string; name: string }[];
    tester: string | null;
    /** the stage to show (the Dock list opens one environment); otherwise the one under way */
    stage?: ReleaseStage;
    t: Translate;
  },
): ReleaseVM {
  const { t } = o;
  const name = (id: string | null | undefined) =>
    id ? (id === o.me ? t('rel.you') : (d.people[id] ?? t('rel.someone'))) : t('rel.someone');
  const plain = (id: string | null | undefined) => (id ? (d.people[id] ?? '') : '');
  const node = (k: string) => d.nodes.find((n) => n.key === k);
  const nodesOf = (ks: string[]) => ks.map(node).filter((n): n is DeliveryNodeView => !!n);
  const testEnv = d.environments.find((e) => e.tier === 'test_gate');
  const prodEnv = d.environments.find((e) => e.tier === 'production');
  const cfg = d.config;
  const people = d.people;
  const account = (connectorId: string | null | undefined) => {
    const a = o.accounts.find((x) => x.connector_id === connectorId);
    return a?.account
      ? t('rel.account_line', {
          connector: a.connector_name,
          who: a.account.identity ?? a.account.hint,
        })
      : undefined;
  };
  const round = d.flow?.round_no ?? o.ticket.current_round;
  const rd = o.ticket.rounds.find((r) => r.round_no === round);
  const fix = rd?.delivery?.repos[0];
  const files = rd?.delivery?.repos.reduce((n, r) => n + r.files.length, 0) ?? 0;

  const flowTasks: ReleaseTaskView[] = d.flow
    ? d.release_tasks.filter((x) => x.flow_id === d.flow!.id)
    : [];
  const taskOf = (envId: string | undefined) =>
    [...flowTasks].reverse().find((x) => x.environment.id === envId) ?? null;
  const testTask = d.flow ? taskOf(testEnv?.id) : null;
  const prodTask = d.flow ? taskOf(prodEnv?.id) : null;
  const toEnvMr = d.merge_requests.filter((m) => m.direction === 'to_env').at(-1);
  const toMainMr = d.merge_requests.filter((m) => m.direction === 'to_main').at(-1);

  const mainStarted = node('main_request')?.status === 'done';
  const stage: ReleaseVM['stage'] = o.stage ?? (mainStarted ? 'production' : 'test');
  const groups = DELIVERY_STEPS[stage].map((g) => [...g]);
  // retest passed and the merge back not asked for yet: the production release waits on that
  const awaitingMain = stage === 'production' && d.flow?.status === 'running' && !mainStarted;
  const cancelled = d.flow?.status === 'cancelled';
  const task = stage === 'test' ? testTask : prodTask;
  const mr = stage === 'test' ? toEnvMr : toMainMr;
  const env = stage === 'test' ? testEnv : prodEnv;
  const other = stage === 'test' ? prodEnv : testEnv;
  // only this stage's failure: the other environment's card is not where it is retried
  const failed = d.nodes.find(
    (n) => n.status === 'failed' && d.flow?.status === 'running' && groups.flat().includes(n.key),
  );
  const stepOf = (slot: ReleaseStepView['slot']) =>
    task?.steps.filter((s) => s.slot === slot).at(-1) ?? null;
  const retest = node('retest');
  const passedRec = d.test_records.find(
    (r) => r.result === 'passed' && r.release_task_id === testTask?.id,
  );

  // —— stepper ——
  const reviewers = stage === 'test' ? cfg?.test_reviewers : cfg?.main_reviewers;
  const groupNodes = groups.map(nodesOf);
  const stepNames =
    stage === 'test'
      ? [
          'rel.step.merge_test',
          'rel.step.build',
          'rel.step.release_test',
          'rel.step.verify',
          'rel.step.notify_tester',
        ]
      : [
          'rel.step.merge_main',
          'rel.step.build',
          'rel.step.release_prod',
          'rel.step.verify',
          'rel.step.notify',
        ];
  const steps = groupNodes.map((ns, i) => {
    const tone: StepTone = d.flow ? groupTone(ns) : 'wait';
    const err = ns.find((n) => n.status === 'failed');
    let sub: string;
    if (err) sub = errLine(err.error);
    else if (i === 0)
      sub =
        tone === 'ok'
          ? t('rel.sub.reviewed', { who: plain(mr?.reviewer_id) })
          : tone === 'you'
            ? t('rel.sub.waiting_review', {
                who: d.can.review_mr ? t('rel.you') : policyText(reviewers, people, t),
                iid: mr?.external_iid ?? '',
              })
            : t('rel.sub.mr_by', { who: policyText(reviewers, people, t) });
    else if (i === 1) {
      const b = stepOf('build');
      sub =
        tone === 'ok'
          ? [
              shortCmd(b?.command) || t('rel.sub.build'),
              took(t, ns[0]?.started_at ?? null, ns.at(-1)?.finished_at ?? null),
            ]
              .filter(Boolean)
              .join(' · ')
          : tone === 'run'
            ? t('rel.sub.building')
            : t('rel.sub.build');
    } else if (i === 2) {
      const r = stepOf('release');
      sub =
        tone === 'ok'
          ? [
              shortCmd(r?.command) || t('rel.sub.release'),
              took(t, ns[0]?.started_at ?? null, ns[0]?.finished_at ?? null),
            ]
              .filter(Boolean)
              .join(' · ')
          : t('rel.sub.release');
    } else if (i === 3)
      sub =
        tone === 'ok'
          ? t('rel.sub.verified')
          : tone === 'run'
            ? t('rel.sub.verifying')
            : t('rel.sub.verify');
    else
      sub =
        tone === 'ok'
          ? stage === 'test'
            ? t('rel.sub.notified', { who: plain(d.tester_id), at: hm(ns[0]?.finished_at ?? null) })
            : t('rel.sub.notified_all')
          : failed
            ? t('rel.sub.not_sent')
            : t('rel.sub.notify');
    if (!err && failed && tone === 'wait' && i !== 4) sub = t('rel.sub.not_run');
    if (cancelled && tone !== 'ok') {
      // a flow sent back: the MR step shows who sent it back, the rest never ran
      if (i === 0 && mr?.state === 'rejected')
        return {
          name: t(stepNames[i]!),
          tone: 'err' as StepTone,
          sub: t('rel.sub.mr_rejected', { who: plain(mr.reviewer_id) }),
        };
      return {
        name: t(stepNames[i]!),
        tone: 'wait' as StepTone,
        sub: t(i === 4 ? 'rel.sub.not_sent' : 'rel.sub.not_run'),
      };
    }
    return { name: t(stepNames[i]!), tone, sub };
  });

  // —— status pill, title, meta ——
  const envName = env?.name ?? t(stage === 'test' ? 'rel.env.test' : 'rel.env.prod');
  const done = steps.filter((s) => s.tone === 'ok').length;
  const failedStep = steps.find((s) => s.tone === 'err');
  let pill: ReleaseVM['pill'];
  const rejectedTest =
    testTask?.status === 'retest_rejected' ||
    d.test_records.some((r) => r.result === 'rejected' && r.release_task_id === testTask?.id);
  if (!d.flow) pill = { tone: 'gray', text: t('rel.pill.before') };
  else if (stage === 'test' && retest?.status === 'done')
    pill = { tone: 'green', text: t('rel.pill.retest_passed') };
  else if (cancelled)
    pill =
      mr?.state === 'rejected' || (stage === 'test' && rejectedTest)
        ? { tone: 'red', text: t('rel.pill.rejected') }
        : { tone: 'gray', text: t('rel.pill.cancelled') };
  else if (awaitingMain) pill = { tone: 'orange', text: t('rel.pill.main_request') };
  else if (failedStep)
    pill = { tone: 'red', text: t('rel.pill.failed', { step: failedStep.name }) };
  else if (stage === 'test' && retest?.status === 'waiting_human')
    pill = { tone: 'green', text: t('rel.pill.pending_retest') };
  else if (steps[0]!.tone === 'you')
    pill = {
      tone: 'orange',
      text: d.can.review_mr ? t('rel.pill.review_you') : t('rel.pill.review_wait'),
    };
  else if (stage === 'production' && node('prod_request')?.status === 'waiting_human')
    pill = {
      tone: 'orange',
      text: d.can.release_prod ? t('rel.pill.release_you') : t('rel.pill.release_wait'),
    };
  else if (d.flow.status === 'done') pill = { tone: 'green', text: t('rel.pill.effective') };
  else pill = { tone: 'teal', text: t('rel.pill.running', { n: Math.min(done + 1, 5) }) };

  const approved = rd?.review;
  const title = t('rel.title', { round, env: envName });
  const meta = awaitingMain
    ? t('rel.meta.main_request', {
        who: plain(passedRec?.tester_id) || t('rel.someone'),
        at: passedRec ? hm(passedRec.at) : '',
      })
    : task
      ? t('rel.meta.task', {
          no: task.no,
          who: name(task.triggered_by),
          at: hm(task.created_at),
        })
      : approved?.result === 'approved'
        ? t('rel.meta.before', {
            who: name(approved.reviewer_id),
            at: hm(approved.at),
            sha: sha7(fix?.head_sha),
          })
        : t('rel.meta.not_approved');

  // —— environment cards ——
  const liveOf = (e: typeof env) => e?.live_version ?? t('rel.env.none');
  const card = (e: typeof env, primary: boolean): ReleaseVM['envs'][number] => {
    const nm = e?.name ?? t(e === prodEnv ? 'rel.env.prod' : 'rel.env.test');
    const tk = e === testEnv ? testTask : prodTask;
    if (!primary) {
      // the other environment: what has to happen before it moves
      if (e === prodEnv && prodTask?.status === 'effective')
        return {
          name: nm,
          on: true,
          tag: { tone: 'green', text: t('rel.env.tag.effective') },
          from: prodTask.version ?? liveOf(e),
          note: shortTime(prodTask.created_at, t),
        };
      if (e === prodEnv)
        return {
          name: nm,
          on: false,
          tag: { tone: 'gray', text: t('rel.env.tag.not_released') },
          from: liveOf(e),
          note: t('rel.env.prod_path'),
        };
      const rec = passedRec;
      return {
        name: nm,
        on: true,
        tag: { tone: 'green', text: t('rel.env.tag.retest_passed') },
        from: testTask?.version ?? liveOf(e),
        note: rec ? `${plain(rec.tester_id)} · ${shortTime(rec.at, t)}` : '',
      };
    }
    const effective = tk && (tk.status === 'effective' || tk.status === 'effective_pending_retest');
    if (!d.flow || !tk)
      return {
        name: nm,
        on: true,
        tag: {
          tone: cancelled ? 'gray' : 'orange',
          text: t(
            cancelled
              ? 'rel.env.tag.unchanged'
              : awaitingMain
                ? 'rel.env.tag.wait_merge'
                : stage === 'production'
                  ? 'rel.env.tag.wait_release'
                  : 'rel.env.tag.wait_start',
          ),
        },
        from: liveOf(e),
        to: { text: t('rel.env.after_build'), mono: false },
        note:
          stage === 'production' ? t('rel.env.on_main', { branch: cfg?.main_branch ?? '' }) : '',
      };
    if (failedStep)
      return {
        name: nm,
        on: true,
        tag: { tone: 'gray', text: t('rel.env.tag.unchanged') },
        from: liveOf(e),
        ...(tk.version ? { to: { text: tk.version, mono: true, struck: true } } : {}),
        note: t('rel.env.no_effect'),
      };
    if (effective && stage === 'test' && retest?.status === 'done')
      return {
        name: nm,
        on: true,
        tag: { tone: 'green', text: t('rel.env.tag.retest_passed') },
        from: tk.version ?? '',
        note: passedRec ? `${plain(passedRec.tester_id)} · ${shortTime(passedRec.at, t)}` : '',
      };
    if (effective && e?.live_version && e.live_version !== tk.version)
      return {
        name: nm,
        on: true,
        tag: { tone: 'gray', text: t('rel.env.tag.effective') },
        from: tk.version ?? '',
        note: t('rel.env.now_live', { version: e.live_version }),
      };
    if (effective)
      return {
        name: nm,
        on: true,
        tag: { tone: 'green', text: t('rel.env.tag.effective') },
        from:
          e?.live_version === tk.version ? (e?.previous_version ?? t('rel.env.none')) : liveOf(e),
        to: { text: tk.version ?? '', mono: true },
        note: t('rel.env.verified'),
      };
    if (tk.status === 'waiting_human' && steps[0]!.tone === 'ok')
      return {
        name: nm,
        on: true,
        tag: { tone: 'orange', text: t('rel.env.tag.wait_release') },
        from: liveOf(e),
        to: { text: t('rel.env.after_build'), mono: false },
        note: t('rel.env.on_main', { branch: cfg?.main_branch ?? '' }),
      };
    const verifying = steps[3]!.tone === 'run';
    const merging = steps[0]!.tone !== 'ok';
    return {
      name: nm,
      on: true,
      tag: merging
        ? { tone: 'orange', text: t('rel.env.tag.wait_merge') }
        : {
            tone: verifying ? 'teal' : 'blue',
            text: t(verifying ? 'rel.env.tag.verifying' : 'rel.env.tag.releasing'),
          },
      from: liveOf(e),
      to: tk.version
        ? { text: tk.version, mono: true }
        : { text: t('rel.env.after_build'), mono: false },
      note: verifying ? t('rel.env.verifying') : '',
    };
  };
  const envs = [card(env, true), card(other, false)];

  // —— left card ——
  let pkg: ReleaseVM['pkg'];
  const failedTask = failed ? task : null;
  const failedRunStep =
    failed && failedTask ? failedTask.steps.find((s) => s.status === 'failed') : null;
  if (failed) {
    const lines = [
      ...(failedRunStep?.command ? [{ text: `$ ${failedRunStep.command}` }] : []),
      ...(failedRunStep?.log_tail ?? '')
        .split('\n')
        .filter(Boolean)
        .slice(-6)
        .map((text) => ({ text })),
      ...(failed.error ?? '')
        .split('\n')
        .filter(Boolean)
        .slice(0, 4)
        .map((text) => ({ text, err: true })),
    ];
    const stepName = steps.find((s) => s.tone === 'err')?.name ?? '';
    pkg = {
      kind: 'failure',
      title: t('rel.fail.title', { step: stepName }),
      lines,
      copy: lines.map((l) => l.text).join('\n'),
    };
  } else if (stage === 'production') {
    pkg = {
      kind: 'rows',
      title: t('rel.pkg.vs_test'),
      ref: prodTask?.build_commit
        ? `${cfg?.main_branch ?? ''}@${sha7(prodTask.build_commit)}`
        : toMainMr
          ? `!${toMainMr.external_iid ?? ''} → ${toMainMr.target_branch}`
          : '',
      rows: [
        {
          tone: 'ok',
          title: t('rel.pkg.same_as_test'),
          sub: t('rel.pkg.same_sub', {
            iid: toMainMr?.external_iid ?? '',
            n: files,
            sha: sha7(fix?.head_sha),
          }),
        },
      ],
    };
  } else {
    const merged = toEnvMr?.state === 'merged' || steps[0]!.tone === 'ok';
    pkg = {
      kind: 'rows',
      title: t(merged ? 'rel.pkg.sent' : 'rel.pkg.will_send'),
      ref: testTask?.build_commit
        ? `${cfg?.test_branch ?? ''}@${sha7(testTask.build_commit)}`
        : (cfg?.test_branch ?? ''),
      rows: [
        merged
          ? {
              tone: 'ok',
              title: t('rel.pkg.in'),
              sub: t('rel.pkg.in_sub', {
                iid: toEnvMr?.external_iid ?? '',
                n: files,
                sha: sha7(fix?.head_sha),
              }),
            }
          : {
              tone: 'blue',
              title: t('rel.pkg.will_mr', { branch: cfg?.test_branch ?? '' }),
              sub: t('rel.pkg.will_mr_sub', {
                sha: sha7(fix?.head_sha),
                n: files,
                who: policyText(cfg?.test_reviewers, people, t),
              }),
            },
      ],
    };
  }

  // —— right card ——
  const testerId = d.flow ? d.tester_id : (o.tester ?? d.tester_id);
  const testerName = plain(testerId) || t('rel.someone');
  let side: ReleaseVM['side'];
  if (failed) {
    const label = steps.find((s) => s.tone === 'err')?.name ?? '';
    side = {
      kind: 'retry',
      tester: { name: testerName, sub: t('rel.retry.not_notified') },
      label: t('rel.retry.label', { step: label }),
      note: t(
        failed.key.endsWith('_merge') || failed.key.endsWith('_open')
          ? 'rel.retry.note_mr'
          : 'rel.retry.note',
      ),
    };
  } else if (steps[0]!.tone === 'you' && mr) {
    side = {
      kind: 'review',
      waiting: d.can.review_mr ? t('rel.review.you') : t('rel.review.wait'),
      reviewer: {
        name: d.can.review_mr
          ? `${t('rel.you')} · ${plain(o.me)}`
          : policyText(reviewers, people, t),
        who: d.can.review_mr ? plain(o.me) : policyText(reviewers, people, t),
        sub: t(stage === 'test' ? 'rel.review.sub_test' : 'rel.review.sub_main'),
      },
      ...(d.can.review_mr ? { actions: { account: account(cfg?.code_connector_id) } } : {}),
      note: t('rel.review.note'),
      head: mr.head_sha ?? '',
    };
  } else if (stage === 'production') {
    side = {
      kind: 'notify',
      names: t('rel.notify.names', { tester: testerName }),
      who: testerName,
      note: t('rel.notify.note', { env: envName }),
    };
  } else {
    // a release that ended is shown as it ended: nothing to pick or start there
    const before = !d.flow;
    const notified = steps[4]!.tone === 'ok';
    side = {
      kind: 'tester',
      tester: {
        id: testerId,
        name: testerName,
        sub: before
          ? t('rel.tester.default')
          : notified
            ? retest?.status === 'done'
              ? t('rel.tester.passed', { at: passedRec ? hm(passedRec.at) : '' })
              : t('rel.tester.notified', { at: hm(node('test_notify')?.finished_at ?? null) })
            : cancelled
              ? t('rel.tester.not_notified')
              : t('rel.tester.keep'),
      },
      ...(before
        ? {
            hint: t('rel.tester.hint'),
            pick: {
              options: o.members.length
                ? o.members
                : testerId
                  ? [{ id: testerId, name: testerName }]
                  : [],
            },
            start: {
              label: t('rel.start', { env: testEnv?.name ?? t('rel.env.test') }),
              account: account(cfg?.provider_connector_id),
              who: t('rel.start_who', { who: policyText(cfg?.test_deployers, people, t) }),
              enabled: d.can.start_test,
            },
          }
        : notified && testEnv
          ? { entry: { url: testEnv.entry_url } }
          : cancelled
            ? {}
            : { note: t('rel.tester.note', { who: testerName }) }),
    };
  }

  // —— stage table ——
  const rowOf = (key: string, label: string, what: string, slot?: ReleaseStepView['slot']) => {
    const n = node(key);
    const st = n?.status ?? 'pending';
    const result: ReleaseVM['table']['rows'][number]['result'] =
      st === 'done'
        ? { tone: 'green', text: t('rel.res.ok') }
        : st === 'failed'
          ? { tone: 'red', text: t('rel.res.failed') }
          : st === 'running'
            ? { tone: 'teal', text: t(slot === 'verify' ? 'rel.res.verifying' : 'rel.res.running') }
            : st === 'waiting_human'
              ? { tone: 'orange', text: t('rel.res.review') }
              : failed
                ? { tone: 'gray', text: t('rel.res.not_run') }
                : { tone: 'gray', text: t('rel.res.wait') };
    const time =
      n?.started_at && n.finished_at && hm(n.started_at) !== hm(n.finished_at)
        ? `${hm(n.started_at)}–${hm(n.finished_at)}`
        : n?.finished_at
          ? hm(n.finished_at)
          : n?.started_at
            ? t('rel.res.since', { at: hm(n.started_at) })
            : '–';
    return { stage: label, what, time, result };
  };
  const mrNode = (prefix: string) =>
    ['merge', 'review', 'open']
      .map((x) => node(`${prefix}_mr_${x}`))
      .find((n) => n && n.status !== 'pending');
  const mrRow = (prefix: 'test' | 'main') => {
    const m = prefix === 'test' ? toEnvMr : toMainMr;
    const n = mrNode(prefix);
    const label = t(prefix === 'test' ? 'rel.step.merge_test' : 'rel.step.merge_main');
    const branch = prefix === 'test' ? (cfg?.test_branch ?? '') : (cfg?.main_branch ?? '');
    const what = m
      ? m.state === 'merged' || node(`${prefix}_mr_merge`)?.status === 'done'
        ? t('rel.what.mr_merged', {
            iid: m.external_iid ?? '',
            who: plain(m.reviewer_id),
            sha: sha7(m.merge_sha ?? m.head_sha),
          })
        : t('rel.what.mr_open', {
            iid: m.external_iid ?? '',
            src: m.source_branch,
            branch,
            who: policyText(
              prefix === 'test' ? cfg?.test_reviewers : cfg?.main_reviewers,
              people,
              t,
            ),
          })
      : t('rel.what.mr_will', {
          sha: sha7(fix?.head_sha),
          branch,
          who: policyText(prefix === 'test' ? cfg?.test_reviewers : cfg?.main_reviewers, people, t),
        });
    const base = rowOf(n?.key ?? `${prefix}_mr_open`, label, what);
    if (n?.status === 'waiting_human') base.result = { tone: 'orange', text: t('rel.res.review') };
    return base;
  };
  const p = stage === 'test' ? 'test' : 'prod';
  const build = stepOf('build');
  const pub = stepOf('publish');
  const rel = stepOf('release');
  const buildNode = node(`${p}_build`);
  const publishNode = node(`${p}_publish`);
  const buildRow = rowOf(
    publishNode?.status === 'pending' || !publishNode ? `${p}_build` : `${p}_publish`,
    t('rel.step.build'),
    build?.status === 'succeeded' && pub?.status === 'succeeded'
      ? t('rel.what.built', { cmd: build.command ?? '', version: task?.version ?? '' })
      : build?.status === 'failed'
        ? t('rel.what.build_failed', { cmd: build.command ?? '', code: build.exit_code ?? '' })
        : t('rel.what.build', {
            branch: stage === 'test' ? (cfg?.test_branch ?? '') : (cfg?.main_branch ?? ''),
          }),
    'build',
  );
  if (buildNode?.status === 'failed') {
    buildRow.result = { tone: 'red', text: t('rel.res.failed') };
  }
  if (buildNode?.started_at && publishNode?.finished_at)
    buildRow.time =
      hm(buildNode.started_at) === hm(publishNode.finished_at)
        ? hm(publishNode.finished_at)
        : `${hm(buildNode.started_at)}–${hm(publishNode.finished_at)}`;
  const verifyWhat = t(
    node(`${p}_verify`)?.status === 'done' ? 'rel.what.verified' : 'rel.what.verify',
    { env: envName, sha: sha7(task?.build_commit) || t('rel.what.this_build') },
  );
  const table = {
    note: d.flow ? t('rel.table.note') : t('rel.table.note_before'),
    rows: [
      mrRow(stage === 'test' ? 'test' : 'main'),
      buildRow,
      rowOf(
        `${p}_release`,
        t(stage === 'test' ? 'rel.step.release_test' : 'rel.step.release_prod'),
        rel?.command ?? t('rel.what.release', { env: envName }),
        'release',
      ),
      rowOf(`${p}_verify`, t('rel.step.verify'), verifyWhat, 'verify'),
    ],
  };

  // —— rail ——
  const records: ReleaseVM['rail']['records'] = d.test_records.map((r) => ({
    tone: r.result === 'passed' ? 'green' : r.result === 'rejected' ? 'red' : 'blue',
    tag: t(`rel.rec.${r.result}`),
    version: r.version ?? '',
    who:
      r.result === 'pending'
        ? `${name(r.tester_id)} · ${t('rel.rec.now')}`
        : `${name(r.tester_id)} · ${shortTime(r.at, t)}`,
    ...(r.comment ? { comment: `“${r.comment}”` } : {}),
    ...(r.result === 'pending' && d.can.retest ? { decide: r.release_task_id } : {}),
  }));
  if (d.flow && testTask && !records.length && stage === 'test' && steps[4]!.tone !== 'ok')
    records.unshift({
      tone: 'gray',
      tag: t('rel.rec.todo'),
      version: testTask.version ?? '',
      who: t('rel.rec.until_live'),
    });
  const gates = [
    {
      label: t('rel.gate.code_review'),
      ok: d.prod_gates.code_review || o.ticket.status === 'approved' || o.ticket.status === 'done',
    },
    { label: t('rel.gate.retest'), ok: d.prod_gates.retest },
    {
      label: d.prod_gates.main_merged
        ? t('rel.gate.main_merged')
        : node('main_mr_review')?.status === 'waiting_human'
          ? t('rel.gate.main_waiting')
          : t(d.can.request_main ? 'rel.gate.main' : 'rel.gate.main_merged'),
      ok: d.prod_gates.main_merged,
    },
  ];
  const logSteps = [...(testTask?.steps ?? []), ...(prodTask?.steps ?? [])].sort((a, b) =>
    a.started_at.localeCompare(b.started_at),
  );
  const log = logSteps
    .flatMap((s) => {
      const lines = (s.log_tail ?? '').split('\n').filter(Boolean);
      const at = s.finished_at ?? s.started_at;
      return [
        ...(s.command ? [{ ts: hms(s.started_at), text: s.command }] : []),
        ...lines.slice(-2).map((text) => ({ ts: hms(at), text })),
        ...(s.status === 'failed' && s.error ? [{ ts: hms(at), text: errLine(s.error) }] : []),
      ];
    })
    .slice(-3);
  const rail: ReleaseVM['rail'] = {
    records,
    highlightRecords: records.some((r) => r.decide),
    gates,
    ...(d.can.request_main
      ? {
          mainRequest: {
            label: t('rel.main_request'),
            note: t('rel.main_request_note', { who: policyText(cfg?.main_reviewers, people, t) }),
          },
        }
      : {}),
    prod: {
      enabled: d.can.release_prod,
      ...(d.can.release_prod ? { account: account(cfg?.provider_connector_id) } : {}),
      who: t('rel.prod_who', { who: policyText(cfg?.prod_deployers, people, t) }),
    },
    highlightProd: d.can.request_main || d.can.release_prod,
    log,
  };

  return {
    stage,
    title,
    meta,
    history: new Set(d.release_tasks.map((x) => x.id)).size,
    pill,
    envs,
    steps,
    pkg,
    side,
    table,
    rail,
    retryKey: failed ? d.can.retry : null,
    reviewHead: d.can.review_mr ? (mr?.head_sha ?? null) : null,
  };
}
