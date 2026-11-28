// The ticket's release tab (01 §12.2, §12.3, §12.5; designs PC-工单-发布, PC-发测试-发布前,
// PC-发布-等复测, PC-发布-复测通过, PC-合回主分支-MR审核, PC-发正式, PC-发布-失败,
// PC-第一次发布-配账号): one skeleton for every state — title row, environments, five-step bar, what
// goes out and who acts, the stage table — plus its rail (test records, the production gates, the log).
import type { PersonalAccountRow } from '@cloudcraft/core-protocol';
import {
  ArrowRightIcon,
  BoxIcon,
  Button,
  Card,
  CheckBoldIcon,
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  CopyIcon,
  KeyIcon,
  LoaderIcon,
  LockIcon,
  RefreshIcon,
  RocketIcon,
  ScrollArea,
  ServerIcon,
  UndoIcon,
  Avatar,
  useT,
} from '@cloudcraft/ui-kit';
import { useState, type ReactNode } from 'react';
import type { ReleaseVM, StepTone, TagTone } from './release-map.ts';

const errText = (e: unknown) => (e as { message?: string }).message ?? String(e);
const Tag = (p: { tone: TagTone; children: ReactNode }) => (
  <span className={`wb-tag is-${p.tone}`}>{p.children}</span>
);
const Ck = (p: { tone: 'ok' | 'blue' | 'warn' | 'off'; children?: ReactNode }) => (
  <span className={`wb-ck is-${p.tone}`}>
    {p.children ?? (p.tone === 'ok' ? <CheckIcon width={11} height={11} /> : null)}
  </span>
);
const initials = (name: string) => name.slice(0, 2);

function Dot({ tone, i }: { tone: StepTone; i: number }) {
  return (
    <span className={`wb-pdot is-${tone}`}>
      {tone === 'ok' ? (
        <CheckBoldIcon width={14} height={14} />
      ) : tone === 'run' ? (
        <LoaderIcon />
      ) : tone === 'err' ? (
        '!'
      ) : (
        i + 1
      )}
    </span>
  );
}

function AccountLine(p: { text?: string; onChange: () => void }) {
  const t = useT();
  if (!p.text) return null;
  return (
    <div className="row g6 f12 t2 wb-acct">
      <KeyIcon width={12} height={12} />
      <span className="grow ell">{p.text}</span>
      <span className="wb-link" role="button" onClick={p.onChange}>
        {t('rel.change')}
      </span>
    </div>
  );
}

export interface ReleaseActions {
  busy?: boolean;
  error?: string | null;
  onTester: (id: string) => void;
  onStart: () => void;
  onApproveMr: () => void;
  onRejectMr: () => void;
  onRetry: () => void;
  onPass: (releaseTaskId: string) => void;
  onRejectTest: (releaseTaskId: string) => void;
  onRequestMain: () => void;
  onReleaseProd: () => void;
  /** 改 › next to an account: set it up again */
  onAccount: (which: 'provider' | 'code') => void;
}

function SideCard({ vm, a }: { vm: ReleaseVM; a: ReleaseActions }) {
  const t = useT();
  const s = vm.side;
  if (s.kind === 'review')
    return (
      <div className="card col wb-side-card is-you">
        <div className="row g8">
          <span className="wb-sec grow">{t('rel.review.title')}</span>
          <Tag tone="orange">{s.waiting}</Tag>
        </div>
        <div className="row g10 wb-person">
          <Avatar name={s.reviewer.who} label={initials(s.reviewer.who)} size={30} />
          <div className="col grow" style={{ minWidth: 0 }}>
            <span className="f13 w6 ell">{s.reviewer.name}</span>
            <span className="f11 t3 ell">{s.reviewer.sub}</span>
          </div>
        </div>
        {s.actions ? (
          <>
            <div className="row g8" style={{ marginTop: 12 }}>
              <Button variant="red" size="lg" onClick={a.onRejectMr} disabled={a.busy}>
                <UndoIcon />
                {t('rel.review.reject')}
              </Button>
              <Button
                variant="pri"
                size="lg"
                className="grow"
                style={{ justifyContent: 'center' }}
                onClick={a.onApproveMr}
                disabled={a.busy}
              >
                <CheckBoldIcon />
                {t('rel.review.approve')}
              </Button>
            </div>
            <AccountLine text={s.actions.account} onChange={() => a.onAccount('code')} />
          </>
        ) : null}
        <div className="f12 t3" style={{ marginTop: 8, lineHeight: 1.6 }}>
          {s.note}
        </div>
      </div>
    );
  if (s.kind === 'retry')
    return (
      <div className="card col wb-side-card">
        <span className="wb-sec">{t('rel.tester.title')}</span>
        <div className="row g10 wb-person">
          <Avatar name={s.tester.name} label={initials(s.tester.name)} size={30} />
          <div className="col grow" style={{ minWidth: 0 }}>
            <span className="f13 w6">{s.tester.name}</span>
            <span className="f11 t3">{s.tester.sub}</span>
          </div>
        </div>
        <span className="grow" style={{ minHeight: 16 }} />
        <Button
          variant="pri"
          size="lg"
          style={{ justifyContent: 'center' }}
          onClick={a.onRetry}
          disabled={a.busy || !vm.retryKey}
        >
          <RefreshIcon />
          {s.label}
        </Button>
        <div className="f12 t2" style={{ marginTop: 10, lineHeight: 1.6 }}>
          {s.note}
        </div>
      </div>
    );
  if (s.kind === 'notify')
    return (
      <div className="card col wb-side-card">
        <span className="wb-sec">{t('rel.notify.title')}</span>
        <div className="row g10 wb-person">
          <Avatar name={s.who} label={initials(s.who)} size={30} />
          <div className="col grow" style={{ minWidth: 0 }}>
            <span className="f13 w6 ell">{s.names}</span>
            <span className="f11 t3">{t('rel.notify.who')}</span>
          </div>
        </div>
        <div className="f12 t2" style={{ marginTop: 10, lineHeight: 1.6 }}>
          {s.note}
        </div>
      </div>
    );
  return (
    <div className="card col wb-side-card">
      <div className="row g8">
        <span className="wb-sec grow">{t('rel.tester.title')}</span>
        {s.hint ? <span className="f12 t3">{s.hint}</span> : null}
      </div>
      <div className={`row g10 wb-person${s.pick ? ' is-pick is-focus' : ''}`}>
        <Avatar name={s.tester.name} label={initials(s.tester.name)} size={30} />
        <div className="col grow" style={{ minWidth: 0 }}>
          <span className="f13 w6">{s.tester.name}</span>
          <span className="f11 t3 ell">{s.tester.sub}</span>
        </div>
        {s.pick ? (
          <>
            <ChevronDownIcon style={{ color: 'var(--text-3)' }} />
            <select
              aria-label={t('rel.tester.title')}
              value={s.tester.id ?? ''}
              onChange={(e) => a.onTester(e.target.value)}
            >
              {s.pick.options.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </>
        ) : null}
      </div>
      {s.start ? (
        <>
          <Button
            variant="pri"
            size="lg"
            style={{ justifyContent: 'center', marginTop: 14 }}
            onClick={a.onStart}
            disabled={a.busy || !s.start.enabled}
          >
            <BoxIcon width={15} height={15} />
            {s.start.label}
          </Button>
          <AccountLine text={s.start.account} onChange={() => a.onAccount('provider')} />
          <div className="f12 t3" style={{ marginTop: 6 }}>
            {s.start.who}
          </div>
        </>
      ) : null}
      {s.entry ? (
        <div className="col g6 f13" style={{ marginTop: 12 }}>
          <div className="row g10">
            <span className="t3">{t('rel.tester.entry')}</span>
            <a className="wb-link mono ell" href={s.entry.url} target="_blank" rel="noreferrer">
              {s.entry.url.replace(/^https?:\/\//, '')} ↗
            </a>
          </div>
        </div>
      ) : null}
      {s.note ? (
        <div className="f12 t2" style={{ marginTop: 10, lineHeight: 1.6 }}>
          {s.note}
        </div>
      ) : null}
    </div>
  );
}

function PkgCard({ vm }: { vm: ReleaseVM }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const p = vm.pkg;
  if (p.kind === 'failure')
    return (
      <div className="card grow col" style={{ padding: '14px 16px', minWidth: 0 }}>
        <div className="row g8">
          <span className="wb-sec grow" style={{ color: 'var(--ink-red)' }}>
            {p.title}
          </span>
          <Button
            size="sm"
            onClick={() => {
              void navigator.clipboard?.writeText(p.copy).then(() => setCopied(true));
            }}
          >
            <CopyIcon width={13} height={13} />
            {t(copied ? 'rel.fail.copied' : 'rel.fail.copy')}
          </Button>
        </div>
        <div className="wb-term">
          {p.lines.map((l, i) => (
            <div key={i} className={l.err ? 'is-err' : undefined}>
              {l.text}
            </div>
          ))}
        </div>
      </div>
    );
  return (
    <div className="card grow" style={{ padding: '14px 16px 6px', minWidth: 0 }}>
      <div className="row g8" style={{ marginBottom: 6 }}>
        <span className="wb-sec grow">{p.title}</span>
        <span className="f12 t3 mono ell">{p.ref}</span>
      </div>
      {p.rows.map((r) => (
        <div key={r.title} className="row g10 wb-pkg-row">
          <Ck tone={r.tone === 'ok' ? 'ok' : 'blue'}>{r.tone === 'blue' ? '1' : undefined}</Ck>
          <div className="col grow" style={{ minWidth: 0 }}>
            <span className="f13 w6">{r.title}</span>
            <span className="f12 t3 ell">{r.sub}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReleasePanel({ vm, a }: { vm: ReleaseVM; a: ReleaseActions }) {
  const t = useT();
  return (
    <ScrollArea className="grow wb-rel-scroll" style={{ minHeight: 0 }}>
      <div className="col g12 wb-rel">
        <div className="row g10">
          <span className="f16 w7" style={{ flex: 'none' }}>
            {vm.title}
          </span>
          <span className="f12 t3 grow ell">{vm.meta}</span>
          {vm.history ? (
            <span className="f12 t3" style={{ flex: 'none' }}>
              {t('rel.history', { n: vm.history })}
            </span>
          ) : null}
          <span
            className={`pill p-${vm.pill.tone}${vm.pill.tone === 'teal' ? ' wb-rel-pill is-teal' : ''}`}
          >
            {vm.pill.text}
          </span>
        </div>
        {a.error ? (
          <div className="wb-err" style={{ marginTop: -4 }}>
            {a.error}
          </div>
        ) : null}
        <Card className="row g16 wb-env">
          {vm.envs.map((e, i) => (
            <div key={i} className="row g16" style={{ flex: 1, minWidth: 0 }}>
              {i ? <span className="wb-env-sep" /> : null}
              <div className="col g6" style={{ flex: 1, minWidth: 0, opacity: e.on ? 1 : 0.8 }}>
                <div className="row g8">
                  <span className={`wb-env-ic${e.on ? '' : ' is-off'}`}>
                    <ServerIcon />
                  </span>
                  <span className="f13 w7">{e.name}</span>
                  <Tag tone={e.tag.tone}>{e.tag.text}</Tag>
                </div>
                <div className="row g8">
                  <span className="mono f15 w6">{e.from}</span>
                  {e.to ? (
                    <>
                      <span className="t3">
                        <ArrowRightIcon />
                      </span>
                      <span
                        className={`${e.to.mono ? 'mono f15 w7' : 'f13 w6'} ${e.to.struck ? 'wb-env-old' : 'wb-env-new'}`}
                      >
                        {e.to.text}
                      </span>
                    </>
                  ) : null}
                  <span className="f12 t3 grow ell" style={{ textAlign: 'right' }}>
                    {e.note}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </Card>
        <Card className="wb-pipe" style={{ padding: '16px 10px 12px' }}>
          {vm.steps.map((s, i) => (
            <div key={i} className={`wb-pst${s.tone === 'ok' ? ' is-done' : ''}`}>
              <Dot tone={s.tone} i={i} />
              <span
                className={`f13 w6 wb-pst-name${s.tone === 'you' ? ' is-you' : s.tone === 'err' ? ' is-err' : ''}`}
              >
                {s.name}
              </span>
              <span className="f11 t3">{s.sub}</span>
            </div>
          ))}
        </Card>
        <div className="row g14" style={{ alignItems: 'stretch' }}>
          <PkgCard vm={vm} />
          <SideCard vm={vm} a={a} />
        </div>
        <Card style={{ padding: '12px 16px 4px' }}>
          <div className="row g8" style={{ marginBottom: 6 }}>
            <span className="wb-sec grow">{t('rel.table.title')}</span>
            <span className="f12 t3">{vm.table.note}</span>
          </div>
          <table className="wb-tbl">
            <thead>
              <tr>
                <th style={{ width: '17%' }}>{t('rel.table.stage')}</th>
                <th>{t('rel.table.what')}</th>
                <th style={{ width: '18%' }}>{t('rel.table.time')}</th>
                <th style={{ width: '12%' }}>{t('rel.table.result')}</th>
              </tr>
            </thead>
            <tbody>
              {vm.table.rows.map((r) => (
                <tr key={r.stage}>
                  <td className={`w6${r.result.tone === 'red' ? ' is-err' : ''}`}>{r.stage}</td>
                  <td className="t2" title={r.what}>
                    {r.what}
                  </td>
                  <td className="mono f12 t3">{r.time}</td>
                  <td>
                    <Tag tone={r.result.tone}>{r.result.text}</Tag>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </ScrollArea>
  );
}

export function ReleaseRail({ vm, a }: { vm: ReleaseVM; a: ReleaseActions }) {
  const t = useT();
  const r = vm.rail;
  return (
    <aside className="glass panel col g12 wb-rail">
      <Card
        className={`wb-rail-card${r.highlightRecords ? ' is-you' : ''}`}
        style={{ padding: '12px 14px' }}
      >
        <div className="wb-mini">{t('rel.rec.title')}</div>
        {r.records.length ? (
          r.records.map((x, i) => (
            <div key={i} style={i ? { borderTop: '1px solid var(--hair)' } : undefined}>
              <div className="row g8" style={{ padding: '6px 0' }}>
                <Tag tone={x.tone}>{x.tag}</Tag>
                <span className="mono f12 ell">{x.version}</span>
                <span className="f12 t3 grow ell" style={{ textAlign: 'right' }}>
                  {x.who}
                </span>
              </div>
              {x.decide ? (
                <div className="row g8" style={{ padding: '2px 0 8px' }}>
                  <Button
                    variant="ok"
                    className="grow"
                    style={{ justifyContent: 'center' }}
                    disabled={a.busy}
                    onClick={() => a.onPass(x.decide!)}
                  >
                    <CheckBoldIcon />
                    {t('rel.rec.pass')}
                  </Button>
                  <Button
                    variant="red"
                    className="grow"
                    style={{ justifyContent: 'center' }}
                    disabled={a.busy}
                    onClick={() => a.onRejectTest(x.decide!)}
                  >
                    <UndoIcon />
                    {t('rel.rec.reject')}
                  </Button>
                </div>
              ) : null}
              {x.comment ? (
                <div className="f12 t3" style={{ paddingBottom: 6 }}>
                  {x.comment}
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <div className="f13 t3">{t('rel.rec.none')}</div>
        )}
      </Card>
      <Card
        className={`wb-rail-card${r.highlightProd ? ' is-you' : ''}`}
        style={{ padding: '12px 14px' }}
      >
        <div className="wb-mini">{t('rel.gate.title')}</div>
        {r.gates.map((g, i) => (
          <div key={g.label}>
            <div className="row g8 wb-gate">
              <Ck tone={g.ok ? 'ok' : 'off'} />
              <span className={`grow${g.ok ? '' : ' t2'}`}>{g.label}</span>
              {i === 2 && r.mainRequest ? (
                <Button variant="pri" size="sm" onClick={a.onRequestMain} disabled={a.busy}>
                  {r.mainRequest.label}
                </Button>
              ) : null}
            </div>
            {i === 2 && r.mainRequest ? (
              <div className="f12 t3 wb-gate-sub">{r.mainRequest.note}</div>
            ) : null}
          </div>
        ))}
        <Button
          variant={r.prod.enabled ? 'pri' : 'sec'}
          style={{
            width: '100%',
            justifyContent: 'center',
            marginTop: 8,
            ...(r.prod.enabled ? {} : { opacity: 0.46 }),
          }}
          disabled={!r.prod.enabled || a.busy}
          onClick={a.onReleaseProd}
        >
          <RocketIcon />
          {t('rel.prod')}
        </Button>
        <AccountLine text={r.prod.account} onChange={() => a.onAccount('provider')} />
        <div className="f12 t3" style={{ marginTop: 8 }}>
          {r.prod.who}
        </div>
      </Card>
      <Card style={{ padding: '12px 14px' }}>
        <div className="wb-mini">{t(r.log.length ? 'rel.log.title' : 'rel.log.title_empty')}</div>
        {r.log.length ? (
          <div className="wb-log t2">
            {r.log.map((l, i) => (
              <div key={i} className="ln">
                <span className="ts">{l.ts}</span>
                <span>{l.text}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="f13 t3">{t('rel.log.empty')}</div>
        )}
      </Card>
    </aside>
  );
}

/** One field of a personal account form, from the plugin's personal_auth_schema (TypeBox / JSON Schema). */
function fieldsOf(schema: unknown): string[] {
  const props = (schema as { properties?: Record<string, unknown> } | null)?.properties ?? {};
  return Object.keys(props);
}

/**
 * PC-第一次发布-配账号: the caller's own account on a shared connector, asked for right where the
 * action needs it; saved (after a test login on the server) and the action continues.
 */
export function AccountDialog(p: {
  account: PersonalAccountRow;
  /** 发布 or 合入: what the account is for, and the button that continues */
  purpose: 'release' | 'merge';
  /** the action that continues after saving; none when the account is only changed */
  action?: string;
  footnote?: string;
  onClose: () => void;
  onSave: (credential: Record<string, string>) => Promise<void>;
}) {
  const t = useT();
  const fields = fieldsOf(p.account.personal_auth_schema);
  const [v, setV] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const label = (f: string) => {
    const key = `rel.acct.field.${f}`;
    const s = t(key);
    return s === key ? f : s;
  };
  const secret = (f: string) => /pass|token|secret|key/i.test(f);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await p.onSave(v);
      setOk(true);
    } catch (e) {
      setError(errText(e));
      setBusy(false);
    }
  };
  return (
    <>
      <div className="cc-scrim" onClick={p.onClose} />
      <div className="cc-dialog wb-dlg" role="dialog" aria-modal="true" style={{ width: 540 }}>
        <div className="row g10">
          <span className="wb-icbox is-orange">
            <KeyIcon width={16} height={16} />
          </span>
          <div className="col grow" style={{ minWidth: 0 }}>
            <div className="row g8" style={{ minWidth: 0 }}>
              <span className="f18 w7 ell">
                {t(p.purpose === 'release' ? 'rel.acct.title_release' : 'rel.acct.title_merge', {
                  connector: p.account.connector_name,
                })}
              </span>
              <Tag tone="blue">
                {t(p.purpose === 'release' ? 'rel.acct.kind_release' : 'rel.acct.kind_code')}
              </Tag>
            </div>
            <span className="f12 t3" style={{ marginTop: 2 }}>
              {t('rel.acct.sub', { connector: p.account.connector_name })}
            </span>
          </div>
          <button type="button" className="cc-close" aria-label={t('ob.close')} onClick={p.onClose}>
            <CloseIcon width={15} height={15} />
          </button>
        </div>
        <div className="row g12" style={{ marginTop: 18, alignItems: 'flex-start' }}>
          {fields.map((f, i) => (
            <label key={f} className="col grow" style={{ minWidth: 0 }}>
              <span className="wb-flabel">
                {i === 0 && fields.length > 1
                  ? `${p.account.connector_name} ${label(f)}`
                  : label(f)}
              </span>
              <input
                className="wb-input wb-acct-input"
                type={secret(f) ? 'password' : 'text'}
                autoFocus={i === 0}
                autoComplete="off"
                value={v[f] ?? ''}
                onChange={(e) => setV({ ...v, [f]: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void submit();
                }}
              />
            </label>
          ))}
        </div>
        {ok ? (
          <div className="row g8 wb-ok-bar">
            <Ck tone="ok" />
            <span className="f13 grow">{t('rel.acct.ok')}</span>
          </div>
        ) : null}
        {error ? <div className="wb-err">{error}</div> : null}
        <div className="row g8 f12 t3" style={{ marginTop: 14, alignItems: 'flex-start' }}>
          <LockIcon width={13} height={13} style={{ flex: 'none', marginTop: 2 }} />
          <span style={{ lineHeight: 1.6 }}>
            {t(p.purpose === 'release' ? 'rel.acct.where' : 'rel.acct.where_merge')}
          </span>
        </div>
        <div className="row g10 wb-dlg-ft">
          <span className="f12 t3 grow ell">{p.footnote}</span>
          <button type="button" className="cc-btn cc-btn-md cc-btn-sec" onClick={p.onClose}>
            {t('ob.cancel')}
          </button>
          <button
            type="button"
            className="cc-btn cc-btn-md cc-btn-pri"
            style={{ padding: '0 18px' }}
            disabled={busy || fields.some((f) => !v[f]?.trim())}
            onClick={submit}
          >
            {p.purpose === 'release' ? <BoxIcon width={14} height={14} /> : <CheckBoldIcon />}
            {p.action ? t('rel.acct.save_and', { action: p.action }) : t('rel.acct.save')}
          </button>
        </div>
      </div>
    </>
  );
}
