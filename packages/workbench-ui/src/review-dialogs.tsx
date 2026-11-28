// Dialogs over the workbench (01 §3.4, §10.15; designs PC-打回原因, PC-手动新建工单): send a round
// back with the reason the bot will read, and create a manual ticket that goes to the bot at once.
import { BotIcon, ChevronDownIcon, CloseIcon, PlusIcon, UndoIcon, useT } from '@cloudcraft/ui-kit';
import { useState, type ReactNode } from 'react';

const errText = (e: unknown) => (e as { message?: string }).message ?? String(e);

function Dialog(p: {
  width: number;
  icon: ReactNode;
  iconClass: string;
  title: string;
  sub: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  const t = useT();
  return (
    <>
      <div className="cc-scrim" onClick={p.onClose} />
      <div className="cc-dialog wb-dlg" role="dialog" aria-modal="true" style={{ width: p.width }}>
        <div className="row g10">
          <span className={`wb-icbox ${p.iconClass}`}>{p.icon}</span>
          <div className="col grow" style={{ minWidth: 0 }}>
            <span className="f18 w7">{p.title}</span>
            <span className="f12 t3" style={{ marginTop: 2 }}>
              {p.sub}
            </span>
          </div>
          <button type="button" className="cc-close" aria-label={t('ob.close')} onClick={p.onClose}>
            <CloseIcon width={15} height={15} />
          </button>
        </div>
        {p.children}
        <div className="row g10 wb-dlg-ft">{p.footer}</div>
      </div>
    </>
  );
}

export const REJECT_CHIPS = [
  'still_broken',
  'regression',
  'insufficient_verification',
  'approach_rejected',
] as const;

export function RejectDialog(p: {
  /** default 打回第 N 轮; an MR or a retest sent back says so */
  title?: string;
  ticketNo: string;
  round: number;
  sha: string;
  onClose: () => void;
  onSubmit: (v: { comment: string; category?: (typeof REJECT_CHIPS)[number] }) => Promise<void>;
}) {
  const t = useT();
  const [comment, setComment] = useState('');
  const [category, setCategory] = useState<(typeof REJECT_CHIPS)[number] | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await p.onSubmit({ comment: comment.trim(), ...(category ? { category } : {}) });
    } catch (e) {
      setError(errText(e));
      setBusy(false);
    }
  };
  return (
    <Dialog
      width={600}
      icon={<UndoIcon width={16} height={16} />}
      iconClass="is-red"
      title={p.title ?? t('wb.reject.title', { round: p.round })}
      sub={
        <>
          {p.ticketNo} · {t('wb.review.target')} <span className="mono">{p.sha}</span> ·{' '}
          {t('wb.reject.to_bot')}
        </>
      }
      onClose={p.onClose}
      footer={
        <>
          <span className="f12 t3 grow">{t('wb.reject.summary', { round: p.round + 1 })}</span>
          <button type="button" className="cc-btn cc-btn-md cc-btn-sec" onClick={p.onClose}>
            {t('ob.cancel')}
          </button>
          <button
            type="button"
            className="cc-btn cc-btn-md cc-btn-danger-solid"
            style={{ padding: '0 18px' }}
            disabled={!comment.trim() || busy}
            onClick={submit}
          >
            <UndoIcon width={14} height={14} />
            {t('wb.reject.submit')}
          </button>
        </>
      }
    >
      <div className="wb-flabel" style={{ marginTop: 14 }}>
        {t('wb.reject.reason')}
      </div>
      <textarea
        className="wb-field"
        rows={4}
        autoFocus
        value={comment}
        maxLength={5000}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t('wb.reject.placeholder')}
      />
      <div className="row g6 wrap" style={{ marginTop: 7 }}>
        <span className="f12 t3">{t('wb.reject.common')}</span>
        {REJECT_CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            className={`wb-chip${category === c ? ' is-on' : ''}`}
            onClick={() => {
              setCategory(category === c ? undefined : c);
              if (!comment.trim()) setComment(t(`wb.reject.cat.${c}`));
            }}
          >
            {t(`wb.reject.cat.${c}`)}
          </button>
        ))}
      </div>
      {error ? <div className="wb-err">{error}</div> : null}
    </Dialog>
  );
}

export interface NewTicketProject {
  id: string;
  name: string;
  /** has a writable repository, so a bot can work on it */
  ready: boolean;
  env?: { name: string; url: string } | null;
}

const PRIORITIES = ['P1', 'P2', 'P3'] as const;

export function NewTicketDialog(p: {
  projects: NewTicketProject[];
  me: string;
  onClose: () => void;
  onSubmit: (v: {
    project_id: string;
    title: string;
    body: string;
    priority: (typeof PRIORITIES)[number];
  }) => Promise<void>;
}) {
  const t = useT();
  const [project, setProject] = useState(p.projects.find((x) => x.ready)?.id ?? '');
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>('P2');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cur = p.projects.find((x) => x.id === project);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await p.onSubmit({ project_id: project, title: title.trim(), body: body.trim(), priority });
    } catch (e) {
      setError(errText(e));
      setBusy(false);
    }
  };
  return (
    <Dialog
      width={650}
      icon={<PlusIcon width={18} height={18} />}
      iconClass="is-blue"
      title={t('wb.new.title')}
      sub={t('wb.new.sub')}
      onClose={p.onClose}
      footer={
        <>
          <span className="f12 t3 grow">{t('wb.new.note')}</span>
          <button type="button" className="cc-btn cc-btn-md cc-btn-sec" onClick={p.onClose}>
            {t('ob.cancel')}
          </button>
          <button
            type="button"
            className="cc-btn cc-btn-md cc-btn-pri"
            style={{ padding: '0 20px' }}
            disabled={!project || !title.trim() || busy}
            onClick={submit}
          >
            <BotIcon width={14} height={14} />
            {t('wb.new.submit')}
          </button>
        </>
      }
    >
      <div className="col g12" style={{ marginTop: 16 }}>
        <div className="row g14" style={{ alignItems: 'flex-start' }}>
          <div className="col g6 grow">
            <span className="f12 w6 t2">{t('wb.new.project')}</span>
            <div className="row g6 wrap">
              {p.projects.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  disabled={!x.ready}
                  className={`pill ${x.id === project ? 'p-blue wb-pill-on' : 'p-gray'} wb-pillbtn`}
                  onClick={() => setProject(x.id)}
                >
                  {t(x.ready ? 'wb.new.project_ready' : 'wb.new.project_no_repo', { name: x.name })}
                </button>
              ))}
            </div>
          </div>
          <div className="col g6">
            <span className="f12 w6 t2">{t('wb.new.priority')}</span>
            <div className="row g6">
              {PRIORITIES.map((x) => (
                <button
                  key={x}
                  type="button"
                  className={`pill ${x === priority ? 'p-red wb-pill-on is-red' : 'p-gray'} wb-pillbtn`}
                  onClick={() => setPriority(x)}
                >
                  {t(`wb.new.priority.${x}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="row g14">
          <div className="col g6 grow" style={{ minWidth: 0 }}>
            <span className="f12 w6 t2">{t('wb.new.env')}</span>
            <div className="row g8 wb-sel">
              <span
                className="dot"
                style={{
                  width: 7,
                  height: 7,
                  background: cur?.env ? 'var(--green)' : 'var(--text-3)',
                }}
              />
              <span className="f13 w6">{cur?.env?.name ?? t('wb.new.env_none')}</span>
              <span className="mono f11 t3 grow ell">
                {cur?.env?.url.replace(/^https?:\/\//, '') ?? ''}
              </span>
              <ChevronDownIcon style={{ color: 'var(--text-3)' }} />
            </div>
          </div>
          <div className="col g6" style={{ width: 220, flex: 'none' }}>
            <span className="f12 w6 t2">{t('wb.new.assignee')}</span>
            <div className="row g8 wb-sel">
              <span className="f13 w6 grow ell">{t('wb.new.me', { name: p.me })}</span>
              <ChevronDownIcon style={{ color: 'var(--text-3)' }} />
            </div>
          </div>
        </div>
        <div className="col g6">
          <span className="f12 w6 t2">{t('wb.new.ticket_title')}</span>
          <input
            className="wb-input"
            autoFocus
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="col g6">
          <div className="row">
            <span className="f12 w6 t2 grow">{t('wb.new.steps')}</span>
            <span className="f11 t3">{t('wb.new.steps_hint')}</span>
          </div>
          <textarea
            className="wb-field is-well"
            rows={4}
            maxLength={20000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('wb.new.steps_placeholder')}
          />
        </div>
      </div>
      {error ? <div className="wb-err">{error}</div> : null}
    </Dialog>
  );
}
