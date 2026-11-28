// Wizard step 3: environments and the accounts the Bot signs in with (01 §11 step 3; designs
// PC-首次使用步骤器, PC-步骤器-3-添加账号; 06 §2.4 env_accounts). Saving or changing a secret lets the
// Bot try it at once; the table shows the result of its last sign-in. Secrets never come back here.
import type {
  CreateEnvAccountRequest,
  EnvAccountRow,
  EnvLoginResult,
  EnvironmentRow,
  ProjectRow,
} from '@cloudcraft/core-protocol';
import {
  AlertIcon,
  BoltIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  EyeIcon,
  HelpChatIcon,
  LockIcon,
  MergeIcon,
  PencilIcon,
  PlusIcon,
  SparkleOutlineIcon,
  UserIcon,
  useT,
} from '@cloudcraft/ui-kit';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Drawer } from './onboarding-drawers.tsx';
import {
  BackButton,
  Footer,
  Head,
  errText,
  waitFlow,
  type OnboardingCalls,
} from './onboarding-parts.tsx';

const TIERS = ['test_gate', 'dev', 'production'] as const;
/** the page answered for at least one account: the environment opens */
const OPENED = new Set(['ok', 'expired', 'no_login']);

const mmdd = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function StepEnvironments(p: {
  calls: OnboardingCalls;
  projects: ProjectRow[];
  onCount: (envs: number, accounts: number) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const t = useT();
  const { calls, onCount } = p;
  const [project, setProject] = useState(p.projects[0]?.id ?? '');
  const [envs, setEnvs] = useState<Record<string, EnvironmentRow[]>>({});
  const [accounts, setAccounts] = useState<Record<string, EnvAccountRow[]>>({});
  const [envId, setEnvId] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', entry_url: '', env_tier: 'test_gate' });
  const [drawer, setDrawer] = useState<{ accountId?: string } | null>(null);
  /** accounts the Bot is signing in with right now */
  const [trying, setTrying] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const live = useRef(new AbortController());
  useEffect(() => {
    const c = new AbortController();
    live.current = c;
    return () => c.abort();
  }, []);

  const ids = p.projects.map((x) => x.id).join(',');
  useEffect(() => {
    let on = true;
    void Promise.all(
      ids
        .split(',')
        .filter(Boolean)
        .map(
          async (id) =>
            [
              id,
              await calls.environments(id),
              await calls.envAccounts(id).catch(() => []),
            ] as const,
        ),
    ).then((rows) => {
      if (!on) return;
      setEnvs(Object.fromEntries(rows.map(([id, e]) => [id, e])));
      setAccounts(Object.fromEntries(rows.map(([id, , a]) => [id, a])));
    });
    return () => {
      on = false;
    };
  }, [ids, calls]);
  useEffect(() => {
    onCount(
      Object.values(envs).reduce((s, x) => s + x.length, 0),
      Object.values(accounts).reduce((s, x) => s + x.length, 0),
    );
  }, [envs, accounts, onCount]);

  const list = envs[project] ?? [];
  const env = list.find((e) => e.id === envId) ?? list[0];
  const projectAccounts = accounts[project] ?? [];
  const rows = projectAccounts.filter((a) => a.environment_id === env?.id);
  const roles = [...new Set(projectAccounts.map((a) => a.role_name))];

  const reloadAccounts = useCallback(
    async (projectId: string) => {
      const a = await calls.envAccounts(projectId);
      setAccounts((x) => ({ ...x, [projectId]: a }));
    },
    [calls],
  );
  /** the Bot tries the account (flow started by the server); its row spins until the flow ends */
  const watch = useCallback(
    async (projectId: string, accountId: string, flowId: string | null) => {
      if (!flowId) return;
      setTrying((s) => new Set(s).add(accountId));
      await waitFlow(calls, flowId, live.current.signal);
      if (live.current.signal.aborted) return;
      await reloadAccounts(projectId).catch(() => {});
      setTrying((s) => {
        const n = new Set(s);
        n.delete(accountId);
        return n;
      });
    },
    [calls, reloadAccounts],
  );
  const put = (a: EnvAccountRow) =>
    setAccounts((x) => ({
      ...x,
      [project]: (x[project] ?? []).some((y) => y.id === a.id)
        ? (x[project] ?? []).map((y) => (y.id === a.id ? a : y))
        : [...(x[project] ?? []), a],
    }));
  const patch = async (
    a: EnvAccountRow,
    body: { role_name?: string; data_permission?: string },
  ) => {
    setError(null);
    try {
      const r = await calls.updateEnvAccount(project, a.id, body as never);
      put(r.account);
      void watch(project, a.id, r.flow_id);
    } catch (e) {
      setError(errText(e));
    }
  };

  const addEnv = async () => {
    setError(null);
    try {
      const code =
        `${form.env_tier === 'test_gate' ? 'test' : form.env_tier === 'production' ? 'prod' : 'dev'}` +
        (list.some((e) => e.env_tier === form.env_tier) ? `-${list.length + 1}` : '');
      const e = await calls.createEnvironment(project, { ...form, env_code: code });
      setEnvs({ ...envs, [project]: [...list, e] });
      setEnvId(e.id);
      setAdding(false);
      setForm({ name: '', entry_url: '', env_tier: 'test_gate' });
    } catch (x) {
      setError(errText(x));
    }
  };

  const editing = projectAccounts.find((a) => a.id === drawer?.accountId);
  return (
    <>
      <div className="ob-fb">
        <Head step={2} ask={t('ob.s3.ask')} />
        <div style={{ marginTop: 18 }}>
          <div className="ob-lab">
            {t('ob.s3.envs')}
            <span>{t('ob.s3.envs.sub')}</span>
            {p.projects.length > 1 ? (
              <>
                <span className="grow" />
                <div className="cc-seg cc-seg-sm">
                  {p.projects.map((x) => (
                    <span
                      key={x.id}
                      className={x.id === project ? 'on' : undefined}
                      onClick={() => {
                        setProject(x.id);
                        setEnvId('');
                      }}
                    >
                      {x.name}
                    </span>
                  ))}
                </div>
              </>
            ) : null}
          </div>
          {!p.projects.length ? (
            <div className="ob-empty">{t('ob.s3.no_project')}</div>
          ) : (
            <div className="ob-envs">
              {list.map((e) => {
                const accs = projectAccounts.filter((a) => a.environment_id === e.id);
                const opened = accs.some((a) => OPENED.has(a.login.state));
                return (
                  <button
                    key={e.id}
                    type="button"
                    className={`ob-env${e.id === env?.id ? ' is-on' : ''}`}
                    onClick={() => setEnvId(e.id)}
                  >
                    <div className="row g6">
                      <b className="ell">{e.name}</b>
                      <span
                        className={`cc-tag ${e.env_tier === 'production' ? 'cc-tag-o' : 'cc-tag-b'}`}
                      >
                        {t(`ob.tier.${e.env_tier}`)}
                      </span>
                      <span className="grow" />
                      {opened ? (
                        <span className="ob-envok">
                          <CheckIcon width={13} height={13} />
                          {t('ob.s3.env.opened')}
                        </span>
                      ) : null}
                    </div>
                    <div className="mono f12 t2 ell" style={{ marginTop: 6 }}>
                      {e.entry_url.replace(/^https?:\/\//, '')}
                    </div>
                    <div className="f12 t3" style={{ marginTop: 3 }}>
                      {t('ob.s3.env.accounts', { n: accs.length })}
                    </div>
                  </button>
                );
              })}
              <button type="button" className="ob-env is-add" onClick={() => setAdding(true)}>
                <PlusIcon width={16} height={16} />
                {t('ob.s3.add')}
              </button>
            </div>
          )}
          {adding ? (
            <div className="ob-envform">
              <div>
                <div className="ob-flab">{t('ob.s3.f.name')}</div>
                <label className="ob-dinp is-md">
                  <input
                    value={form.name}
                    maxLength={40}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={t('ob.s3.f.name.placeholder')}
                  />
                </label>
              </div>
              <div>
                <div className="ob-flab">{t('ob.s3.f.url')}</div>
                <label className="ob-dinp is-md">
                  <input
                    className="mono"
                    value={form.entry_url}
                    onChange={(e) => setForm({ ...form, entry_url: e.target.value })}
                    placeholder="https://"
                  />
                </label>
              </div>
              <div>
                <div className="ob-flab">{t('ob.s3.f.tier')}</div>
                <label className="ob-dinp is-md ob-dsel">
                  <select
                    value={form.env_tier}
                    onChange={(e) => setForm({ ...form, env_tier: e.target.value })}
                  >
                    {TIERS.map((x) => (
                      <option key={x} value={x}>
                        {t(`ob.tier.${x}`)}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon />
                </label>
              </div>
              <div className="row g8">
                <button
                  type="button"
                  className="cc-btn cc-btn-md cc-btn-pri"
                  disabled={!form.name.trim() || !/^https?:\/\//.test(form.entry_url)}
                  onClick={addEnv}
                >
                  {t('ob.s3.f.save')}
                </button>
                <button
                  type="button"
                  className="cc-btn cc-btn-md cc-btn-sec"
                  onClick={() => setAdding(false)}
                >
                  {t('ob.cancel')}
                </button>
              </div>
            </div>
          ) : null}
          <div className="ob-note" style={{ marginTop: 10, padding: '8px 12px' }}>
            <MergeIcon />
            <span>
              <b>{t('ob.s3.rule.title')}</b>
              {t('ob.s3.rule.body')}
            </span>
          </div>
          {env ? (
            <div style={{ marginTop: 16 }}>
              <div className="ob-lab">
                {t('ob.s3.acc.title', { env: env.name })}
                <span>{t('ob.s3.acc.sub')}</span>
              </div>
              <div className="ob-accs">
                <div className="ob-acch">
                  <span>{t('ob.s3.acc.role')}</span>
                  <span>{t('ob.s3.acc.account')}</span>
                  <span>{t('ob.s3.acc.secret')}</span>
                  <span>{t('ob.s3.acc.perm')}</span>
                  <span>{t('ob.s3.acc.bot')}</span>
                </div>
                {rows.map((a) => (
                  <AccountLine
                    key={a.id}
                    a={a}
                    roles={roles}
                    trying={trying.has(a.id)}
                    onEdit={() => setDrawer({ accountId: a.id })}
                    onPatch={(body) => patch(a, body)}
                  />
                ))}
              </div>
              <div className="row g10" style={{ marginTop: 8 }}>
                <button type="button" className="ob-lnk f13" onClick={() => setDrawer({})}>
                  {t('ob.s3.acc.add')}
                </button>
                <span className="grow" />
                <span className="ob-legend">
                  <EyeIcon />
                  <b>{t('ob.perm.read_only')}</b>
                  {t('ob.perm.read_only.legend')}
                </span>
                <span className="ob-legend">
                  <PencilIcon />
                  <b>{t('ob.perm.read_write')}</b>
                  {t('ob.perm.read_write.legend')}
                </span>
              </div>
            </div>
          ) : null}
          {error ? <div className="ob-err">{error}</div> : null}
        </div>
        <div
          className="ob-note"
          style={{ marginTop: 'auto', marginBottom: 14, background: 'var(--fill)' }}
        >
          <HelpChatIcon />
          <span>
            <b>{t('ob.s3.data.title')}</b>
            {t('ob.s3.data.body')}
          </span>
        </div>
      </div>
      <Footer>
        <BackButton onClick={p.onBack} />
        <span className="grow" />
        <span className="f13 t3" style={{ marginRight: 6 }}>
          {t('ob.s3.skip')}
        </span>
        <button type="button" className="ob-bigb ob-pri" onClick={p.onNext}>
          {t('ob.s3.next')}
          <ChevronRightIcon />
        </button>
      </Footer>
      {drawer && env ? (
        <AccountDrawer
          calls={calls}
          projectId={project}
          envs={list}
          envId={editing?.environment_id ?? env.id}
          account={editing}
          roles={roles}
          onClose={() => setDrawer(null)}
          onAddEnv={() => {
            setDrawer(null);
            setAdding(true);
          }}
          onSaved={(a, flowId) => {
            setDrawer(null);
            put(a);
            setEnvId(a.environment_id);
            void watch(project, a.id, flowId);
          }}
          onDeleted={(id) => {
            setDrawer(null);
            setAccounts((x) => ({
              ...x,
              [project]: (x[project] ?? []).filter((y) => y.id !== id),
            }));
          }}
        />
      ) : null}
    </>
  );
}

function AccountLine(p: {
  a: EnvAccountRow;
  roles: string[];
  trying: boolean;
  onEdit: () => void;
  onPatch: (body: { role_name?: string; data_permission?: string }) => void;
}) {
  const t = useT();
  const { a } = p;
  const [role, setRole] = useState(a.role_name);
  useEffect(() => setRole(a.role_name), [a.role_name]);
  const cookie = a.credential_type === 'cookie';
  const expired = a.login.state === 'expired';
  const listId = `ob-roles-${a.id}`;
  return (
    <div className="ob-accr">
      <label className="ob-dinp ob-role">
        <input
          value={role}
          maxLength={40}
          list={listId}
          onChange={(e) => setRole(e.target.value)}
          onBlur={() => {
            const v = role.trim();
            if (v && v !== a.role_name) p.onPatch({ role_name: v });
            else setRole(a.role_name);
          }}
        />
        <datalist id={listId}>
          {p.roles.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
      </label>
      <button
        type="button"
        className={`ob-dinp ob-acell${cookie ? ' is-bot' : ''}`}
        onClick={p.onEdit}
      >
        <UserIcon />
        <span className="grow ell">
          {a.account_name ??
            (a.login.state === 'ok' || a.login.state === 'no_login'
              ? t('ob.s3.acc.cookie_unknown')
              : t('ob.s3.acc.cookie_pending'))}
        </span>
        {cookie && a.account_name ? (
          <span className="cc-tag cc-tag-p">{t('ob.s3.acc.bot_id')}</span>
        ) : null}
      </button>
      <button
        type="button"
        className={`ob-dinp ob-acell is-secret${expired ? ' is-warn' : ''}`}
        onClick={p.onEdit}
      >
        <span className="cc-tag cc-tag-n">
          {cookie ? t('ob.cred.cookie') : t('ob.cred.password')}
        </span>
        <span className="grow ell">
          {cookie && a.login.expires_at
            ? t('ob.s3.acc.until', { d: mmdd(a.login.expires_at) })
            : '••••••'}
        </span>
      </button>
      <label className={`ob-dinp ob-dsel ob-perm-sel is-${a.data_permission}`}>
        {a.data_permission === 'read_write' ? <PencilIcon /> : <EyeIcon />}
        <select
          value={a.data_permission}
          onChange={(e) => p.onPatch({ data_permission: e.target.value })}
        >
          <option value="read_only">{t('ob.perm.read_only')}</option>
          <option value="read_write">{t('ob.perm.read_write')}</option>
        </select>
        <ChevronDownIcon />
      </label>
      <LoginState a={a} trying={p.trying} />
    </div>
  );
}

function LoginState(p: { a: EnvAccountRow; trying: boolean }) {
  const t = useT();
  if (p.trying)
    return (
      <span className="ob-login is-run">
        <span className="cc-spinner cc-spinner-sm" />
        {t('ob.login.trying')}
      </span>
    );
  const s = p.a.login.state;
  const tone = s === 'ok' ? 'is-ok' : s === 'failed' ? 'is-bad' : s === 'expired' ? 'is-warn' : '';
  return (
    <span className={`ob-login ${tone}`} title={p.a.login.error ?? undefined}>
      {s === 'ok' ? <CheckIcon width={13} height={13} /> : s === 'unchecked' ? null : <AlertIcon />}
      {t(`ob.login.${s}`)}
    </span>
  );
}

// ---------- add / edit an account ----------

function AccountDrawer(p: {
  calls: OnboardingCalls;
  projectId: string;
  envs: EnvironmentRow[];
  envId: string;
  account?: EnvAccountRow;
  roles: string[];
  onClose: () => void;
  onAddEnv: () => void;
  onSaved: (a: EnvAccountRow, flowId: string | null) => void;
  onDeleted: (id: string) => void;
}) {
  const t = useT();
  const edit = p.account;
  const [envId, setEnvId] = useState(p.envId);
  const env = p.envs.find((e) => e.id === envId);
  const [role, setRole] = useState(edit?.role_name ?? '');
  const [type, setType] = useState<'password' | 'cookie'>(edit?.credential_type ?? 'password');
  const [name, setName] = useState(
    edit?.credential_type === 'password' ? (edit.account_name ?? '') : '',
  );
  const [secret, setSecret] = useState('');
  const [perm, setPerm] = useState<'read_only' | 'read_write'>(
    edit?.data_permission ?? (env?.env_tier === 'production' ? 'read_only' : 'read_write'),
  );
  const [busy, setBusy] = useState<'try' | 'save' | 'delete' | null>(null);
  const [tried, setTried] = useState<EnvLoginResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const live = useRef(new AbortController());
  useEffect(() => {
    const c = new AbortController();
    live.current = c;
    return () => c.abort();
  }, []);
  // a new secret is needed when adding, or when switching how the Bot signs in
  const needSecret = !edit || type !== edit.credential_type;
  const ready =
    !!env &&
    role.trim().length > 0 &&
    (type === 'cookie' || name.trim().length > 0) &&
    (!needSecret || secret.trim().length > 0);
  const body = (): CreateEnvAccountRequest => ({
    role_name: role.trim(),
    credential_type: type,
    ...(type === 'password' ? { account_name: name.trim() } : {}),
    secret: secret.trim(),
    data_permission: perm,
  });
  const tryLogin = async () => {
    setBusy('try');
    setError(null);
    setTried(null);
    try {
      const { flow_id } = await p.calls.tryEnvAccount(p.projectId, envId, body());
      const f = await waitFlow(p.calls, flow_id, live.current.signal);
      if (!f) return;
      const node = f.nodes.find((n) => (n.output as { results?: unknown } | null)?.results);
      const r = (node?.output as { results?: EnvLoginResult[] } | null)?.results?.[0];
      if (r) setTried(r);
      else setError(f.nodes[f.nodes.length - 1]?.error ?? t('ob.login.failed'));
    } catch (e) {
      setError(errText(e));
    } finally {
      if (!live.current.signal.aborted) setBusy(null);
    }
  };
  const save = async () => {
    setBusy('save');
    setError(null);
    try {
      if (edit) {
        // only what changed: a new name or secret makes the Bot sign in again
        const r = await p.calls.updateEnvAccount(p.projectId, edit.id, {
          ...(role.trim() !== edit.role_name ? { role_name: role.trim() } : {}),
          ...(perm !== edit.data_permission ? { data_permission: perm } : {}),
          ...(type !== edit.credential_type ? { credential_type: type } : {}),
          ...(type === 'password' && name.trim() !== (edit.account_name ?? '')
            ? { account_name: name.trim() }
            : {}),
          ...(secret.trim() ? { secret: secret.trim() } : {}),
        });
        p.onSaved(r.account, r.flow_id);
      } else {
        const r = await p.calls.createEnvAccount(p.projectId, envId, body());
        p.onSaved(r.account, r.flow_id);
      }
    } catch (e) {
      setError(errText(e));
      setBusy(null);
    }
  };
  const remove = async () => {
    if (!edit) return;
    setBusy('delete');
    setError(null);
    try {
      await p.calls.deleteEnvAccount(p.projectId, edit.id);
      p.onDeleted(edit.id);
    } catch (e) {
      setError(errText(e));
      setBusy(null);
    }
  };
  return (
    <Drawer
      icon={
        <span className="ob-acic">
          <UserIcon width={20} height={20} />
        </span>
      }
      title={
        <div className="row g8">
          <span style={{ fontSize: 18, fontWeight: 800 }}>
            {edit ? t('ob.ad.title.edit') : t('ob.ad.title')}
          </span>
          <span className="cc-tag cc-tag-b">{t('ob.ad.bot_try')}</span>
        </div>
      }
      sub={t('ob.ad.sub')}
      onClose={p.onClose}
      footer={
        <>
          {edit ? (
            <button
              type="button"
              className="cc-btn cc-btn-lg cc-btn-sec"
              style={{ color: 'var(--ink-red)' }}
              disabled={!!busy}
              onClick={remove}
            >
              {t('ob.ad.delete')}
            </button>
          ) : (
            <button type="button" className="cc-btn cc-btn-lg cc-btn-sec" onClick={p.onClose}>
              {t('ob.cancel')}
            </button>
          )}
          <span className="grow" />
          <button
            type="button"
            className="cc-btn cc-btn-lg cc-btn-glass"
            disabled={!ready || !secret.trim() || !!busy}
            onClick={tryLogin}
          >
            {busy === 'try' ? <span className="cc-spinner cc-spinner-sm" /> : <BoltIcon />}
            {busy === 'try' ? t('ob.login.trying') : t('ob.ad.try')}
          </button>
          <button
            type="button"
            className="cc-btn cc-btn-lg cc-btn-pri"
            disabled={!ready || !!busy}
            onClick={save}
          >
            <CheckIcon width={14} height={14} />
            {edit ? t('ob.ad.save.edit') : t('ob.ad.save')}
          </button>
        </>
      }
    >
      <div className="ob-tsec">
        <div className="row g12" style={{ alignItems: 'flex-end' }}>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="ob-flab">
              {t('ob.ad.env')}
              <span className="grow" />
              {edit ? null : (
                <button type="button" className="ob-lnk f12" onClick={p.onAddEnv}>
                  {t('ob.ad.add_env')}
                </button>
              )}
            </div>
            <label className="ob-dinp is-md ob-dsel">
              {env ? (
                <span
                  className={`cc-tag ${env.env_tier === 'production' ? 'cc-tag-o' : 'cc-tag-b'}`}
                >
                  {t(`ob.tier.${env.env_tier}`)}
                </span>
              ) : null}
              <select
                value={envId}
                disabled={!!edit}
                onChange={(e) => {
                  setEnvId(e.target.value);
                  const next = p.envs.find((x) => x.id === e.target.value);
                  setPerm(next?.env_tier === 'production' ? 'read_only' : 'read_write');
                  setTried(null);
                }}
              >
                {p.envs.map((e) => (
                  <option key={e.id} value={e.id}>
                    {`${e.name} · ${e.entry_url.replace(/^https?:\/\//, '')}`}
                  </option>
                ))}
              </select>
              <ChevronDownIcon />
            </label>
          </div>
          <div style={{ width: 200, flex: 'none' }}>
            <div className="ob-flab">{t('ob.ad.role')}</div>
            <label className="ob-dinp is-md">
              <input
                value={role}
                maxLength={40}
                list="ob-ad-roles"
                onChange={(e) => setRole(e.target.value)}
                placeholder={t('ob.ad.role.placeholder')}
              />
              <datalist id="ob-ad-roles">
                {p.roles.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </label>
          </div>
        </div>
      </div>
      <div className="ob-tsec">
        <div className="row g8">
          <span className="f13 w7 t2 grow">{t('ob.ad.method')}</span>
          <div className="cc-seg">
            {(['password', 'cookie'] as const).map((x) => (
              <span
                key={x}
                className={type === x ? 'on' : undefined}
                onClick={() => {
                  setType(x);
                  setSecret('');
                  setTried(null);
                }}
              >
                {t(`ob.ad.method.${x}`)}
              </span>
            ))}
          </div>
        </div>
        {type === 'password' ? (
          <div className="row g12">
            <div className="grow">
              <div className="ob-flab">{t('ob.ad.account')}</div>
              <label className="ob-dinp is-md">
                <UserIcon />
                <input
                  value={name}
                  maxLength={120}
                  autoComplete="off"
                  onChange={(e) => {
                    setName(e.target.value);
                    setTried(null);
                  }}
                />
              </label>
            </div>
            <div className="grow">
              <div className="ob-flab">{t('ob.ad.password')}</div>
              <label className="ob-dinp is-md">
                <LockIcon width={15} height={15} />
                <input
                  type="password"
                  autoComplete="new-password"
                  value={secret}
                  onChange={(e) => {
                    setSecret(e.target.value);
                    setTried(null);
                  }}
                  placeholder={edit && !needSecret ? t('ob.ad.keep') : undefined}
                />
              </label>
            </div>
          </div>
        ) : (
          <>
            <div>
              <div className="ob-flab">
                {t('ob.ad.cookie')}
                <span>{t('ob.ad.cookie.hint')}</span>
              </div>
              <textarea
                className="cc-textarea mono ob-cookie"
                rows={3}
                value={secret}
                spellCheck={false}
                onChange={(e) => {
                  setSecret(e.target.value);
                  setTried(null);
                }}
                placeholder={edit && !needSecret ? t('ob.ad.keep') : undefined}
              />
            </div>
            <div className="ob-aitip">
              <SparkleOutlineIcon />
              <span>{t('ob.ad.cookie.tip')}</span>
            </div>
          </>
        )}
      </div>
      <div className="ob-tsec">
        <div className="ob-flab" style={{ marginBottom: 2 }}>
          <b className="f13 t1">{t('ob.ad.perm')}</b>
          <span>{t('ob.ad.perm.sub')}</span>
        </div>
        <div className="row g12" style={{ alignItems: 'stretch' }}>
          {(['read_only', 'read_write'] as const).map((x) => (
            <button
              key={x}
              type="button"
              className={`ob-permc${perm === x ? ' is-on' : ''}`}
              onClick={() => setPerm(x)}
            >
              <div className="row g6">
                {x === 'read_only' ? <EyeIcon /> : <PencilIcon />}
                <b className="grow">
                  {x === 'read_only' && env?.env_tier === 'production'
                    ? t('ob.perm.read_only.rec')
                    : t(`ob.perm.${x}`)}
                </b>
                <span className={`cc-radio${perm === x ? ' is-checked' : ''}`} />
              </div>
              <div className="f12 t2" style={{ marginTop: 6, lineHeight: 1.55 }}>
                {t(`ob.perm.${x}.long`)}
              </div>
            </button>
          ))}
        </div>
      </div>
      {tried ? <TryResult r={tried} /> : null}
      {error ? <div className="ob-err">{error}</div> : null}
    </Drawer>
  );
}

function TryResult({ r }: { r: EnvLoginResult }) {
  const t = useT();
  const ok = r.state === 'ok' || r.state === 'no_login';
  const text =
    r.state === 'ok' && r.identity
      ? t('ob.ad.tried.ok_as', { who: r.identity })
      : r.state === 'failed'
        ? r.opened
          ? t('ob.ad.tried.refused')
          : `${t('ob.ad.tried.unreachable')}${r.error ? `\n${r.error}` : ''}`
        : r.state === 'expired'
          ? t('ob.ad.tried.expired')
          : t(`ob.login.${r.state}`);
  return (
    <div className={`ob-result${ok ? '' : r.state === 'expired' ? ' is-warn' : ' is-bad'}`}>
      {ok ? <CheckIcon width={12} height={12} /> : <AlertIcon />}
      <span className="grow">{text}</span>
    </div>
  );
}
