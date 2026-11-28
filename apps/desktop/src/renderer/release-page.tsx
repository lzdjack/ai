// The Dock's release module (P6c; 01 §10.10、§12.2～§12.5, docs/02 Dock「发布」定案): every ticket's
// releases in one list; a row opens the same panel and rail as that ticket's release tab (docs/02
// 「两个入口一份内容」), with a header naming the ticket and a way back to it. The list is read by the
// caller of this screen (it also gives the Dock badge); the open row's ticket and delivery follow the
// server here.
import type { Me, ReleaseList as ReleaseListDTO, TicketDetail } from '@cloudcraft/core-protocol';
import { useT } from '@cloudcraft/ui-kit';
import {
  ReleaseDetailHead,
  ReleaseEmpty,
  ReleaseList,
  groupReleases,
} from '@cloudcraft/workbench-ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ticketCalls } from './api.ts';
import { aboutTicket, type Live } from './live.ts';
import { useReleaseTab } from './release-tab.tsx';

const EMPTY: ReleaseListDTO = { items: [], next_cursor: null, has_more: false, people: {} };

export function ReleasePage(p: {
  ws: string;
  me: Me;
  live: Live;
  list: ReleaseListDTO | null;
  /** something changed by an action here: read the list again */
  onChanged: () => void;
  /** 「进入工单 ›」: the ticket's own release tab */
  onOpenTicket: (ticketId: string) => void;
}) {
  const t = useT();
  const calls = useMemo(() => ticketCalls(p.ws), [p.ws]);
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);

  const list = p.list ?? EMPTY;
  const { groups, total, rows } = useMemo(() => groupReleases(list, scope, t), [list, scope, t]);
  // open the first row; a row that left the list (another scope, or gone) gives way to the first
  useEffect(() => {
    if (!selected || !rows.some((x) => x.key === selected))
      setSelected(groups[0]?.items[0]?.key ?? null);
  }, [groups, rows, selected]);
  const row = rows.find((x) => x.key === selected) ?? null;
  const ticketId = row?.ticket_id ?? null;

  const openId = useRef(ticketId);
  openId.current = ticketId;
  const loadDetail = useCallback(
    (id: string) =>
      calls.detail(id).then((d) => (d.id === openId.current ? setDetail(d) : undefined)),
    [calls],
  );
  const { live } = p;
  useEffect(() => {
    if (!ticketId) return setDetail(null);
    return live.follow(() => loadDetail(ticketId), aboutTicket(ticketId));
  }, [live, ticketId, loadDetail]);

  const release = useReleaseTab({
    ws: p.ws,
    me: p.me,
    live,
    detail: detail && detail.id === ticketId ? detail : null,
    active: !!row,
    ...(row ? { roundNo: row.round_no, stage: row.stage } : {}),
    bare: true,
    onChanged: () => {
      p.onChanged();
      if (ticketId) void loadDetail(ticketId);
    },
  });

  const list_ = (
    <ReleaseList
      groups={groups}
      total={total}
      scope={scope}
      onScope={setScope}
      selected={selected ?? ''}
      onSelect={setSelected}
    />
  );
  if (!list.items.length)
    return (
      <>
        {list_}
        {p.list ? <ReleaseEmpty /> : <main className="glass panel col grow wb-main" />}
      </>
    );
  if (!row || !release.vm || !detail)
    return (
      <>
        {list_}
        <main className="glass panel col grow wb-main wb-empty">
          {row ? null : <div className="f15 w7">{t('rel.empty.pick')}</div>}
        </main>
      </>
    );
  const assignee = row.assignee_id ? list.people[row.assignee_id] : null;
  return (
    <>
      {list_}
      <main className="glass panel col grow wb-main">
        <ReleaseDetailHead
          vm={release.vm}
          ticketNo={row.ticket_no}
          ticketTitle={row.ticket_title}
          ticketMeta={t('rel.ticket_meta', {
            no: row.ticket_no,
            status: t(`wb.rail.now.${detail.status}`, { round: detail.current_round }),
            who: assignee ?? t('rel.someone'),
          })}
          onOpenTicket={() => p.onOpenTicket(row.ticket_id)}
        />
        {release.panel}
      </main>
      {release.rail}
      {release.dialogs}
    </>
  );
}
