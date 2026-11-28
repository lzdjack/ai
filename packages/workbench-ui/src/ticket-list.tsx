// Ticket list (01 §3.3): grouped by what waits on you, reporter avatar with a status dot, selected row
// in the blue gradient.
import { Avatar, PlusIcon, ScrollArea, Seg, useT } from '@cloudcraft/ui-kit';
import type { TicketGroupVM } from './types.ts';

const DOT: Record<string, string> = {
  blue: 'var(--blue)',
  orange: 'var(--orange)',
  teal: 'var(--teal)',
  green: 'var(--green)',
  red: 'var(--red)',
  gray: 'var(--text-3)',
};

export function TicketList(p: {
  groups: TicketGroupVM[];
  total: number;
  scope: 'mine' | 'all';
  onScope: (s: 'mine' | 'all') => void;
  selected?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  const t = useT();
  return (
    <section className="glass panel col wb-list">
      <div className="row g8" style={{ padding: '0 8px 2px' }}>
        <span className="f18 w7">{t('wb.list.title')}</span>
        <span className="f13 t3">{p.total}</span>
        <button
          type="button"
          className="wb-list-add"
          title={t('wb.list.new')}
          aria-label={t('wb.list.new')}
          onClick={p.onNew}
        >
          <PlusIcon />
        </button>
        <span className="grow" />
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
      <ScrollArea className="grow">
        {p.groups
          .filter((g) => g.items.length)
          .map((g) => (
            <div key={g.key}>
              <div className={`wb-group${g.key === 'need_action' ? ' is-red' : ''}`}>
                {t(`wb.group.${g.key}`)}
                <span>{g.items.length}</span>
              </div>
              {g.items.map((r) => (
                <div
                  key={r.id}
                  className={`wb-row${p.selected === r.id ? ' is-on' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-current={p.selected === r.id ? 'true' : undefined}
                  onClick={() => p.onSelect(r.id)}
                  onKeyDown={(e) => e.key === 'Enter' && p.onSelect(r.id)}
                >
                  <span className="wb-row-av">
                    <Avatar
                      name={r.reporter.name}
                      label={r.reporter.label}
                      tone={r.reporter.system ? 'sys' : r.reporter.tone}
                      size={34}
                    />
                    <span className="wb-row-dot" style={{ background: DOT[r.status] }} />
                  </span>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="row g6">
                      <span className="wb-row-title ell grow">{r.title}</span>
                      {r.time ? <span className="wb-row-time">{r.time}</span> : null}
                      {r.unread ? (
                        <span className="wb-unread" style={{ background: DOT[r.unread] }} />
                      ) : null}
                    </div>
                    <div className="row g6" style={{ marginTop: 3 }}>
                      {r.source ? (
                        <span className={`wb-src${r.sourceOutline ? ' is-outline' : ''}`}>
                          {r.source}
                        </span>
                      ) : null}
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
              ))}
            </div>
          ))}
      </ScrollArea>
    </section>
  );
}
