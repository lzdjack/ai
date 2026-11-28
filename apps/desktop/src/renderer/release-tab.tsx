// The open ticket's release tab on the delivery API (P6b): the tab's panel and rail follow the server
// while the tab is open, every action goes through the server's ActionGate, and an action that needs
// the caller's own account (409 delivery.account_missing) asks for it right there and then continues
// (design PC-第一次发布-配账号).
import type { DeliveryView, Me, PersonalAccountRow, TicketDetail } from '@cloudcraft/core-protocol';
import { useT } from '@cloudcraft/ui-kit';
import {
  AccountDialog,
  RejectDialog,
  ReleasePanel,
  ReleaseRail,
  releaseVM,
  type ReleaseActions,
} from '@cloudcraft/workbench-ui';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, deliveryCalls } from './api.ts';

const POLL_MS = 3000;

type Pending = { connectorId: string; action: string; run: () => Promise<unknown> } | null;

export function useReleaseTab(o: {
  ws: string;
  me: Me;
  detail: TicketDetail | null;
  active: boolean;
  /** the ticket changed (a send-back starts the next round): reload the list and the conversation */
  onChanged: () => void;
}): { panel: ReactNode; rail: ReactNode; dialogs: ReactNode } {
  const t = useT();
  const calls = useMemo(() => deliveryCalls(o.ws), [o.ws]);
  const ticketId = o.detail?.id ?? null;
  const [view, setView] = useState<DeliveryView | null>(null);
  const [accounts, setAccounts] = useState<PersonalAccountRow[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [tester, setTester] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [reject, setReject] = useState<{ kind: 'mr' } | { kind: 'test'; task: string } | null>(
    null,
  );

  const load = useCallback(async () => {
    if (!ticketId) return;
    const v = await calls.view(ticketId);
    setView((cur) => (v.ticket_id === ticketId ? v : cur));
  }, [calls, ticketId]);
  useEffect(() => {
    setView(null);
    setTester(null);
    setError(null);
  }, [ticketId]);
  useEffect(() => {
    if (!o.active || !ticketId) return;
    void load();
    const id = setInterval(() => void load().catch(() => {}), POLL_MS);
    return () => clearInterval(id);
  }, [o.active, ticketId, load]);
  const loadAccounts = useCallback(() => calls.accounts().then(setAccounts), [calls]);
  useEffect(() => {
    if (!o.active) return;
    void loadAccounts().catch(() => {});
    void calls.members().then(setMembers);
  }, [o.active, calls, loadAccounts]);

  /** Runs an action; a missing personal account opens the dialog and the action continues after it. */
  const act = async (action: string, run: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await run();
      await load();
      o.onChanged();
    } catch (e) {
      const ids =
        (e instanceof ApiError && e.code === 'delivery.account_missing'
          ? (e.data?.connector_ids as string[] | undefined)
          : undefined) ?? [];
      if (ids[0]) {
        await loadAccounts().catch(() => {});
        setPending({ connectorId: ids[0], action, run });
      } else setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!o.detail || !view) return { panel: null, rail: null, dialogs: null };
  const id = o.detail.id;
  const vm = releaseVM(view, {
    ticket: o.detail,
    me: o.me.id,
    accounts,
    members,
    tester,
    t,
  });
  const round = view.flow?.round_no ?? o.detail.current_round;
  const startLabel =
    vm.side.kind === 'tester' && vm.side.start ? vm.side.start.label : t('rel.prod');
  const a: ReleaseActions = {
    busy,
    error,
    onTester: setTester,
    onStart: () =>
      act(startLabel, () =>
        calls.startTest(id, {
          round_no: o.detail!.current_round,
          ...((tester ?? view.tester_id) ? { tester_id: (tester ?? view.tester_id)! } : {}),
        }),
      ),
    onApproveMr: () =>
      act(t('rel.review.approve'), () =>
        calls.reviewMerge(id, { decision: 'approve', expected_head_sha: vm.reviewHead ?? '' }),
      ),
    onRejectMr: () => setReject({ kind: 'mr' }),
    onRetry: () =>
      act(vm.side.kind === 'retry' ? vm.side.label : '', () => calls.retry(id, vm.retryKey ?? '')),
    onPass: (task) =>
      act(t('rel.rec.pass'), () => calls.retest(id, { decision: 'pass', release_task_id: task })),
    onRejectTest: (task) => setReject({ kind: 'test', task }),
    onRequestMain: () => act(t('rel.main_request'), () => calls.requestMain(id)),
    onReleaseProd: () => act(t('rel.prod'), () => calls.releaseProd(id)),
    onAccount: (which) => {
      const c =
        which === 'provider' ? view.config?.provider_connector_id : view.config?.code_connector_id;
      if (c) setEdit(c);
    },
  };

  const dialogAccount = (connectorId: string) =>
    accounts.find((x) => x.connector_id === connectorId) ?? null;
  const pendingAccount = pending ? dialogAccount(pending.connectorId) : null;
  const editAccount = edit ? dialogAccount(edit) : null;
  const purpose = (x: PersonalAccountRow) => (x.category === 'release' ? 'release' : 'merge');
  const testerName = view.people[tester ?? view.tester_id ?? ''] ?? '';
  const sha = o.detail.rounds.find((r) => r.round_no === round)?.delivery?.repos[0]?.head_sha;

  const dialogs = (
    <>
      {pending && pendingAccount ? (
        <AccountDialog
          account={pendingAccount}
          purpose={purpose(pendingAccount)}
          action={pending.action}
          footnote={
            testerName && purpose(pendingAccount) === 'release'
              ? t('rel.acct.footnote', { who: testerName })
              : undefined
          }
          onClose={() => setPending(null)}
          onSave={async (credential) => {
            await calls.saveAccount(pending.connectorId, credential);
            await loadAccounts();
            const next = pending;
            setPending(null);
            await act(next.action, next.run);
          }}
        />
      ) : null}
      {edit && editAccount ? (
        <AccountDialog
          account={editAccount}
          purpose={purpose(editAccount)}
          onClose={() => setEdit(null)}
          onSave={async (credential) => {
            await calls.saveAccount(edit, credential);
            await loadAccounts();
            setEdit(null);
          }}
        />
      ) : null}
      {reject ? (
        <RejectDialog
          title={
            reject.kind === 'mr'
              ? t('rel.review.reject_title')
              : t('rel.rec.reject_title', {
                  version:
                    view.test_records.find((r) => r.release_task_id === reject.task)?.version ?? '',
                })
          }
          ticketNo={o.detail.no}
          round={round}
          sha={sha?.slice(0, 7) ?? ''}
          onClose={() => setReject(null)}
          onSubmit={async (v) => {
            if (reject.kind === 'mr')
              await calls.reviewMerge(id, {
                decision: 'reject',
                expected_head_sha: vm.reviewHead ?? '',
                comment: v.comment,
              });
            else
              await calls.retest(id, {
                decision: 'reject',
                release_task_id: reject.task,
                comment: v.comment,
              });
            setReject(null);
            await load();
            o.onChanged();
          }}
        />
      ) : null}
    </>
  );
  return {
    panel: <ReleasePanel vm={vm} a={a} />,
    rail: <ReleaseRail vm={vm} a={a} />,
    dialogs,
  };
}
