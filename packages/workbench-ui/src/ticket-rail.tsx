// Right-hand info rail (01 §3.5): what happened, environment versions, progress of each step.
import { Button, Card, ExternalIcon, Pill, useT } from '@cloudcraft/ui-kit';
import type { TicketDetailVM } from './types.ts';

const BUL: Record<string, string> = {
  blue: 'var(--blue)',
  green: 'var(--green)',
  red: 'var(--red)',
  orange: 'var(--orange)',
  teal: 'var(--teal)',
  gray: 'var(--text-3)',
};

export function TicketRail({ rail }: { rail: TicketDetailVM['rail'] }) {
  const t = useT();
  return (
    <aside className="glass panel col g12 wb-rail">
      <Card style={{ padding: '12px 14px' }}>
        <div className="wb-mini">{t('wb.rail.history')}</div>
        {rail.timeline.map((e, i) => (
          <div key={i} className="wb-tl">
            <div className="wb-tl-rail">
              <span
                className={`wb-tl-bul${e.current ? ' is-current' : ''}`}
                style={{ background: BUL[e.tone] }}
              />
              {i < rail.timeline.length - 1 ? <i /> : null}
            </div>
            <div style={i < rail.timeline.length - 1 ? { paddingBottom: 8 } : undefined}>
              <div className="f13 w6" style={e.current ? { color: 'var(--ink-blue)' } : undefined}>
                {e.title}
              </div>
              <div className="f12 t3">{e.sub}</div>
            </div>
          </div>
        ))}
      </Card>
      <Card style={{ padding: '8px 14px' }}>
        <div className="wb-mini" style={{ margin: '4px 0 2px' }}>
          {t('wb.rail.env')}
        </div>
        <div className="wb-kv">
          <span className="t2">{t('wb.rail.env_test')}</span>
          <span className="mono f12">
            {rail.env.test}{' '}
            {rail.env.testNote ? <span className="t3">· {rail.env.testNote}</span> : null}
          </span>
        </div>
        <div className="wb-kv">
          <span className="t2">{t('wb.rail.env_prod')}</span>
          <span className="mono f12">{rail.env.prod}</span>
        </div>
        <div className="wb-kv">
          <span className="t2">{t('wb.rail.tester')}</span>
          <span className="f13">{rail.env.tester}</span>
        </div>
      </Card>
      <Card style={{ padding: '8px 14px' }}>
        <div className="wb-mini" style={{ margin: '4px 0 2px' }}>
          {t('wb.rail.progress')}
        </div>
        <div className="wb-kv">
          <span className="t2">{t('wb.rail.code_review')}</span>
          {rail.progress.codeReviewWaiting ? (
            <Pill tone="blue" style={{ height: 22 }}>
              {t('wb.rail.waiting_you')}
            </Pill>
          ) : null}
        </div>
        <div className="wb-kv">
          <span className="t2">{t('wb.rail.release')}</span>
          <span className="f12 t3">{rail.progress.release}</span>
        </div>
        <div className="wb-kv">
          <span className="t2">{t('wb.rail.platform')}</span>
          <span className="f12 t3">{rail.progress.platform}</span>
        </div>
        <div className="row g8" style={{ padding: '8px 0 4px' }}>
          <Button size="sm" className="grow" style={{ justifyContent: 'center' }}>
            {t('wb.rail.confirmed_on_source')}
          </Button>
          <Button size="sm" style={{ padding: '0 10px' }} aria-label={t('wb.rail.open_source')}>
            <ExternalIcon />
          </Button>
        </div>
      </Card>
    </aside>
  );
}
