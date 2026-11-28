// Ticket conversation (01 §3.4): header, tabs, the rounds as a conversation with the Bot's steps and
// delivery card, the review row, and the ticket AI composer at the bottom.
import {
  ArrowUpIcon,
  BotIcon,
  BranchIcon,
  Button,
  CheckBoldIcon,
  CheckIcon,
  PaperclipIcon,
  Pill,
  PlayIcon,
  SparkleOutlineIcon,
  Tabs,
  UndoIcon,
  useT,
} from '@cloudcraft/ui-kit';
import type { DeliveryVM, EvidenceShotVM, FlowItemVM, TicketDetailVM } from './types.ts';

function Shot(p: { shot: EvidenceShotVM; after: boolean }) {
  const t = useT();
  return (
    <div className="col g6 wb-shot-col">
      <div className={`shot wb-shot${p.after ? ' is-after' : ''}`}>
        <img src={p.shot.image} alt="" />
        <span className={`wb-shot-tag${p.after ? ' is-ok' : ''}`}>
          {t(p.after ? 'wb.delivery.after_tag' : 'wb.delivery.before_tag', { d: p.shot.duration })}
        </span>
        <span className="wb-shot-play">
          <PlayIcon />
        </span>
      </div>
      <span className="f11 t3">
        {t(p.after ? 'wb.delivery.after_caption' : 'wb.delivery.before_caption')} ·{' '}
        {p.shot.seen ? (
          t('wb.delivery.seen')
        ) : (
          <span className="wb-link">{t('wb.delivery.unseen')}</span>
        )}
      </span>
    </div>
  );
}

function Delivery({ d }: { d: DeliveryVM }) {
  const t = useT();
  return (
    <div className="card wb-delivery">
      <div className="row g8">
        <span className="f15 w7 grow">{t('wb.delivery.title', { round: d.round })}</span>
        <span className="f12 t3">
          {d.by} · {d.at}
        </span>
      </div>
      <div className="f13 t2 wb-delivery-body">
        <b>{t('wb.delivery.root_cause')}</b>
        {d.rootCause}
        {d.response ? (
          <>
            <br />
            <b>{t('wb.delivery.response')}</b>
            {d.response}{' '}
            {d.responseHandled ? <span className="wb-ok">{t('wb.delivery.handled')}</span> : null}
            <span className="wb-link wb-gap">{t('wb.delivery.diff_from_last')}</span>
          </>
        ) : null}
      </div>
      <div className="row g14" style={{ marginTop: 12, alignItems: 'stretch' }}>
        <Shot shot={d.before} after={false} />
        <Shot shot={d.after} after />
        <div className="col g6 grow" style={{ minWidth: 0 }}>
          <span className="f11 t3 ell">{d.verifiedOn}</span>
          {d.checks.map((c) => (
            <div key={c.label} className={`wb-step ${c.untested ? 'is-untested' : 'is-strong'}`}>
              <span className="ck">{c.untested ? '!' : <CheckIcon />}</span>
              {c.label}
            </div>
          ))}
        </div>
      </div>
      <div className="row g10 wb-delivery-foot">
        <BranchIcon style={{ color: 'var(--text-3)' }} />
        <span className="f13">
          {t('wb.delivery.files', { n: d.files.count })}{' '}
          <span className="wb-add">+{d.files.add}</span>{' '}
          <span className="wb-del">−{d.files.del}</span>
        </span>
        <span className="f12 t3">{d.mr}</span>
        <span className="grow" />
        {d.skills.map((s) => (
          <span key={s} className="cc-pill">
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

function Flow({ item }: { item: FlowItemVM }) {
  const t = useT();
  if (item.kind === 'divider') return <div className="wb-divider">{item.text}</div>;
  if (item.kind === 'user')
    return (
      <div className="col" style={{ alignItems: 'flex-end', gap: 4 }}>
        <div className="wb-me">{item.text}</div>
        <span className="f11 t3">{item.note}</span>
      </div>
    );
  return (
    <div className="row g10" style={{ alignItems: 'flex-start' }}>
      <span className="wb-botav">
        <BotIcon width={16} height={16} />
      </span>
      <div className="col g10 grow" style={{ minWidth: 0 }}>
        <div className="row g14 wrap wb-steps">
          {item.steps.map((s) => (
            <span key={s} className="wb-step">
              <span className="ck">
                <CheckIcon />
              </span>
              {s}
            </span>
          ))}
          <span className="grow" />
          <span className="f12 t3">{t('wb.flow.took', { min: item.minutes })}</span>
        </div>
        {item.delivery ? <Delivery d={item.delivery} /> : null}
        {item.review ? (
          <div className="row g10">
            <span className="f12 t3">
              {t('wb.review.target')}{' '}
              <span className="mono" style={{ color: 'var(--text)' }}>
                {item.review.sha}
              </span>
            </span>
            <span className="grow" />
            <Button variant="red">
              <UndoIcon />
              {t('wb.review.reject')}
            </Button>
            <Button variant="pri" style={{ padding: '0 20px' }}>
              <CheckBoldIcon />
              {t('wb.review.approve', { sha: item.review.sha })}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export type TicketTab = 'chat' | 'code' | 'evidence' | 'log' | (string & {});

export function TicketView(p: {
  ticket: TicketDetailVM;
  tab: TicketTab;
  onTab: (t: TicketTab) => void;
}) {
  const t = useT();
  const k = p.ticket;
  return (
    <main className="glass panel col grow wb-main">
      <header className="wb-head">
        <div className="row g12">
          {k.source ? <span className="appic ic-tita">{k.source.code}</span> : null}
          <div className="col grow" style={{ minWidth: 0 }}>
            <h1 className="ell">{k.title}</h1>
            <div className="f12 t3" style={{ marginTop: 2 }}>
              {k.id} · <span style={{ color: 'var(--ink-red)' }}>{k.priority}</span> · {k.metaAfter}
            </div>
          </div>
          <Pill tone={k.state.tone}>{k.state.text}</Pill>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <Tabs
            value={p.tab}
            onChange={p.onTab}
            items={[
              { key: 'chat', label: t('wb.tab.chat') },
              { key: 'code', label: t('wb.tab.code', { n: k.counts.code }) },
              { key: 'evidence', label: t('wb.tab.evidence', { n: k.counts.evidence }) },
              { key: 'log', label: t('wb.tab.log') },
              ...k.extraTabs,
            ]}
          />
          <span className="grow" />
          {k.source ? (
            <span className="f12 wb-link">{t('wb.open_source', { source: k.source.name })}</span>
          ) : null}
        </div>
      </header>
      <div className="col g10 grow wb-flow" style={{ minHeight: 0, overflow: 'hidden' }}>
        {k.flow.map((f, i) => (
          <Flow key={i} item={f} />
        ))}
      </div>
      <div className="wb-composer">
        <div className="row g10 wb-composer-box">
          <span className="row g6 wb-composer-tag">
            <span>
              <SparkleOutlineIcon />
            </span>
            <span className="f13 w7">{t('wb.ai.label')}</span>
            <span className="f12 t3 mono">{k.id}</span>
          </span>
          <span className="f14 t3 grow ell">{t('wb.ai.placeholder')}</span>
          <PaperclipIcon style={{ color: 'var(--text-3)' }} />
          <button type="button" className="wb-send" aria-label={t('wb.ai.send')}>
            <ArrowUpIcon />
          </button>
        </div>
      </div>
    </main>
  );
}
