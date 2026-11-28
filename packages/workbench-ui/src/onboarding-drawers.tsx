// The wizard's right-hand drawers (06 §10.3 items 1, 2, 4; designs PC-步骤器-1-新建连接器鉴权,
// PC-步骤器-2-挑选仓库, PC-步骤器-2-微调配置). The connector form is rendered from the plugin's
// configSchema / authSchema; field names come from i18n (plugin.<id>.<field>) with the schema title as
// fallback, so no platform is written into the page.
import type {
  ConnectorRow,
  PluginInfo,
  ProjectRow,
  RemoteRepo,
  RepoRow,
  RepoSettings,
  VerifyResult,
} from '@cloudcraft/core-protocol';
import {
  AlertIcon,
  BoltIcon,
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  FileIcon,
  FolderIcon,
  GlobeIcon,
  LockIcon,
  PencilIcon,
  ScrollArea,
  SearchIcon,
  SparkleOutlineIcon,
  useT,
} from '@cloudcraft/ui-kit';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Mark,
  errText,
  repoName,
  repoTile,
  type BuildState,
  type OnboardingCalls,
} from './onboarding-parts.tsx';

interface FieldSchema {
  type?: string;
  title?: string;
  pattern?: string;
  minLength?: number;
}
const fieldsOf = (schema: unknown) =>
  Object.entries(
    ((schema as { properties?: Record<string, FieldSchema> }).properties ?? {}) as Record<
      string,
      FieldSchema
    >,
  );

function Drawer(p: {
  icon: ReactNode;
  title: ReactNode;
  sub: ReactNode;
  width?: number;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
  gap?: number;
  z?: number;
}) {
  const t = useT();
  return (
    <>
      <div className="cc-scrim" onClick={p.onClose} style={p.z ? { zIndex: p.z } : undefined} />
      <div
        className="cc-drawer"
        role="dialog"
        aria-modal="true"
        style={{ ...(p.width ? { width: p.width } : {}), ...(p.z ? { zIndex: p.z + 1 } : {}) }}
      >
        <div className="cc-drawer-hd">
          {p.icon}
          <div className="grow" style={{ minWidth: 0 }}>
            {p.title}
            <div className="f12 t3" style={{ marginTop: 2 }}>
              {p.sub}
            </div>
          </div>
          <button type="button" className="cc-close" aria-label={t('ob.close')} onClick={p.onClose}>
            <CloseIcon />
          </button>
        </div>
        <ScrollArea style={{ flex: 1, minHeight: 0 }}>
          <div className="cc-drawer-bd" style={{ gap: p.gap ?? 14, overflow: 'visible' }}>
            {p.children}
          </div>
        </ScrollArea>
        <div className="cc-drawer-ft">{p.footer}</div>
      </div>
    </>
  );
}

// ---------- new connector ----------

export function ConnectorDrawer(p: {
  calls: OnboardingCalls;
  plugins: PluginInfo[];
  initialPlugin?: string;
  z?: number;
  onClose: () => void;
  onSaved: (c: ConnectorRow) => void;
}) {
  const t = useT();
  const [pluginId, setPluginId] = useState(p.initialPlugin ?? p.plugins[0]?.id ?? '');
  const plugin = p.plugins.find((x) => x.id === pluginId);
  const [name, setName] = useState('');
  const [config, setConfig] = useState<Record<string, string>>({});
  const [cred, setCred] = useState<Record<string, string>>({});
  const [check, setCheck] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState<'verify' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const kind = plugin?.category === 'ticket_source' ? 'ticket' : 'code';
  const label = (key: string, f: FieldSchema) => {
    const k = `plugin.${pluginId}.${key}`;
    const v = t(k);
    return v === k ? (f.title ?? key) : v;
  };
  const hint = (key: string) => {
    const k = `plugin.${pluginId}.${key}.hint`;
    const v = t(k);
    return v === k ? '' : v;
  };
  const filled = (schema: unknown, vals: Record<string, string>) =>
    fieldsOf(schema).every(([k, f]) => (vals[k] ?? '').trim().length >= (f.minLength ?? 1));
  const ready =
    !!plugin && filled(plugin.config_schema, config) && filled(plugin.auth_schema, cred);
  const body = () => ({
    plugin_id: pluginId,
    config: Object.fromEntries(Object.entries(config).map(([k, v]) => [k, v.trim()])),
    credential: Object.fromEntries(Object.entries(cred).map(([k, v]) => [k, v.trim()])),
  });
  const verify = async () => {
    setBusy('verify');
    setError(null);
    try {
      setCheck(await p.calls.verify(body()));
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(null);
    }
  };
  const save = async () => {
    setBusy('save');
    setError(null);
    try {
      p.onSaved(await p.calls.createConnector({ ...body(), name: name.trim() || plugin!.name }));
    } catch (e) {
      setError(errText(e));
      setBusy(null);
    }
  };
  const input = (
    key: string,
    f: FieldSchema,
    secret: boolean,
    vals: Record<string, string>,
    set: (v: Record<string, string>) => void,
  ) => (
    <div key={key}>
      <div className="ob-flab">
        {label(key, f)}
        {hint(key) ? <span>{hint(key)}</span> : null}
      </div>
      <div className="row g10">
        <label className="ob-dinp grow">
          {secret ? (
            <LockIcon width={15} height={15} />
          ) : f.pattern?.startsWith('^https?') ? (
            <GlobeIcon />
          ) : null}
          <input
            className="mono"
            type={secret ? 'password' : 'text'}
            autoComplete="off"
            value={vals[key] ?? ''}
            onChange={(e) => {
              set({ ...vals, [key]: e.target.value });
              setCheck(null);
            }}
            placeholder={f.pattern?.startsWith('^https?') ? 'https://' : undefined}
          />
        </label>
        {secret ? (
          <button
            type="button"
            className="cc-btn cc-btn-lg cc-btn-glass"
            disabled={!ready || !!busy}
            onClick={verify}
          >
            <BoltIcon />
            {check ? t('ob.cd.reverify') : t('ob.cd.verify')}
          </button>
        ) : null}
      </div>
    </div>
  );
  return (
    <Drawer
      z={p.z}
      icon={<Mark plugin={plugin} name={plugin?.name ?? '?'} size={40} className="ob-ic3" />}
      title={<div style={{ fontSize: 18, fontWeight: 800 }}>{t(`ob.cd.title.${kind}`)}</div>}
      sub={t('ob.cd.sub')}
      onClose={p.onClose}
      footer={
        <>
          <button type="button" className="cc-btn cc-btn-lg cc-btn-sec" onClick={p.onClose}>
            {t('ob.cancel')}
          </button>
          <span className="grow" />
          <span className="f12 t3">{t('ob.cd.share_note')}</span>
          <button
            type="button"
            className="cc-btn cc-btn-lg cc-btn-pri"
            disabled={!ready || !!busy || check?.ok === false}
            onClick={save}
          >
            {busy === 'save' ? t('ob.cd.saving') : t(`ob.cd.save.${kind}`)}
          </button>
        </>
      }
    >
      <div>
        <div className="ob-flab">
          {t('ob.cd.plugin')}
          <span>{t('ob.cd.plugin.hint')}</span>
        </div>
        <div className="ob-pgrid">
          {p.plugins.map((x) => (
            <button
              key={x.id}
              type="button"
              className={`ob-pitem${x.id === pluginId ? ' is-on' : ''}`}
              onClick={() => {
                setPluginId(x.id);
                setConfig({});
                setCred({});
                setCheck(null);
              }}
            >
              <Mark plugin={x} name={x.name} size={18} />
              {x.name}
            </button>
          ))}
        </div>
      </div>
      {plugin ? (
        <>
          <div>
            <div className="ob-flab">{t('ob.cd.name')}</div>
            <label className="ob-dinp">
              <input
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('ob.cd.name.placeholder', { name: plugin.name })}
              />
            </label>
          </div>
          {fieldsOf(plugin.config_schema).map(([k, f]) => input(k, f, false, config, setConfig))}
          {fieldsOf(plugin.auth_schema).map(([k, f]) => input(k, f, true, cred, setCred))}
        </>
      ) : null}
      {check ? <VerifyBox r={check} /> : null}
      {error ? <div className="ob-err">{error}</div> : null}
    </Drawer>
  );
}

function VerifyBox({ r }: { r: VerifyResult }) {
  const t = useT();
  if (!r.ok)
    return (
      <div className="ob-vbox is-bad">
        <b className="f13" style={{ color: 'var(--ink-red)' }}>
          {t('ob.cd.v.failed')}
        </b>
        <div
          className="f12 t2 mono"
          style={{ marginTop: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
        >
          {r.error_raw}
        </div>
      </div>
    );
  const Ok = (q: { warn?: boolean; children: ReactNode }) => (
    <div className="ob-vrow">
      <span className={`ob-vck${q.warn ? ' is-warn' : ''}`}>
        {q.warn ? <AlertIcon width={10} height={10} /> : <CheckIcon width={10} height={10} />}
      </span>
      <span>{q.children}</span>
    </div>
  );
  return (
    <div className="ob-vbox">
      <div className="row g8" style={{ marginBottom: 6 }}>
        <b className="f13" style={{ color: 'var(--ink-green)' }}>
          {t('ob.cd.v.ok', { ms: r.latency_ms })}
        </b>
      </div>
      <Ok>{t('ob.cd.v.reach')}</Ok>
      {r.identity ? (
        <Ok>
          {t('ob.cd.v.identity')}
          <span className="mono">{r.identity}</span>
          {r.scopes.length ? (
            <>
              {t('ob.cd.v.scopes')}
              <span className="mono">{r.scopes.join(' / ')}</span>
            </>
          ) : null}
        </Ok>
      ) : null}
      <Ok warn={r.has_merge_perm === true}>
        {r.has_merge_perm
          ? t('ob.cd.v.merge_warn')
          : t('ob.cd.v.least', { n: r.visible_repo_count ?? 0 })}
      </Ok>
    </div>
  );
}

// ---------- pick repositories ----------

export function RepoPickerDrawer(p: {
  calls: OnboardingCalls;
  plugins: PluginInfo[];
  connectors: ConnectorRow[];
  repos: RepoRow[];
  initialConnector?: string;
  onNewConnector: (c: ConnectorRow) => void;
  onClose: () => void;
  onAttached: (rows: RepoRow[]) => void;
}) {
  const t = useT();
  const [active, setActive] = useState(p.initialConnector ?? p.connectors[0]?.id ?? '');
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [items, setItems] = useState<Record<string, { items: RemoteRepo[]; has_more: boolean }>>(
    {},
  );
  const [picked, setPicked] = useState<Map<string, { connector: string; remote: string }>>(
    new Map(),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);
  const key = `${active}:${debounced}`;
  const { calls } = p;
  useEffect(() => {
    if (!active) return;
    let live = true;
    setLoading(true);
    setError(null);
    calls
      .remoteRepos(active, debounced)
      .then((r) => live && setItems((x) => ({ ...x, [key]: r })))
      .catch((e) => live && setError(errText(e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [active, debounced, key, calls]);
  const list = items[key]?.items ?? [];
  const groups = useMemo(() => {
    const m = new Map<string, RemoteRepo[]>();
    for (const r of list) {
      const g = r.path.includes('/') ? r.path.slice(0, r.path.lastIndexOf('/')) : '';
      m.set(g, [...(m.get(g) ?? []), r]);
    }
    return [...m.entries()];
  }, [list]);
  const attachedOf = (connector: string, remote: string) =>
    p.repos.find((r) => r.connector_id === connector && r.remote_repo_id === remote);
  const toggle = (remote: string) =>
    setPicked((m) => {
      const n = new Map(m);
      const k = `${active}:${remote}`;
      if (n.has(k)) n.delete(k);
      else n.set(k, { connector: active, remote });
      return n;
    });
  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const by = new Map<string, string[]>();
      for (const v of picked.values())
        by.set(v.connector, [...(by.get(v.connector) ?? []), v.remote]);
      const rows: RepoRow[] = [];
      for (const [c, ids] of by) rows.push(...(await p.calls.attach(c, ids)));
      p.onAttached(rows);
    } catch (e) {
      setError(errText(e));
      setBusy(false);
    }
  };
  const countOf = (id: string) => {
    const r = items[`${id}:`];
    return r ? `${r.items.length}${r.has_more ? '+' : ''}` : null;
  };
  return (
    <>
      <Drawer
        icon={
          <span className="ob-mark ob-ic3 is-search">
            <SearchIcon width={20} height={20} />
          </span>
        }
        title={<div style={{ fontSize: 18, fontWeight: 800 }}>{t('ob.pk.title')}</div>}
        sub={t('ob.pk.sub')}
        onClose={p.onClose}
        gap={12}
        footer={
          <>
            <span className="f12 t2">{t('ob.pk.note')}</span>
            <span className="grow" />
            <button type="button" className="cc-btn cc-btn-lg cc-btn-sec" onClick={p.onClose}>
              {t('ob.cancel')}
            </button>
            <button
              type="button"
              className="cc-btn cc-btn-lg cc-btn-pri"
              disabled={!picked.size || busy}
              onClick={confirm}
            >
              {t('ob.pk.confirm', { n: picked.size })}
            </button>
          </>
        }
      >
        <div className="row g10">
          <div className="cc-tabs" role="tablist">
            {p.connectors.map((c) => (
              <span
                key={c.id}
                role="tab"
                aria-selected={c.id === active}
                className={`cc-tab${c.id === active ? ' is-active' : ''}`}
                onClick={() => setActive(c.id)}
              >
                <Mark
                  plugin={p.plugins.find((x) => x.id === c.plugin_id)}
                  name={c.name}
                  size={16}
                />
                {c.name}
                {countOf(c.id) ? <span className="cc-count">{countOf(c.id)}</span> : null}
              </span>
            ))}
          </div>
          <span className="grow" />
          <button type="button" className="ob-lnk f12" onClick={() => setAdding(true)}>
            {t('ob.pk.new_connector')}
          </button>
        </div>
        <label className="cc-search" style={{ height: 'var(--ctl-md)' }}>
          <SearchIcon width={14} height={14} />
          <input
            className="grow"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('ob.pk.search')}
            style={{
              border: 0,
              background: 'none',
              outline: 'none',
              font: 'inherit',
              color: 'var(--text)',
            }}
          />
          {debounced ? (
            <span className="cc-tag cc-tag-n">{t('ob.pk.hits', { n: list.length })}</span>
          ) : null}
          {q ? (
            <span className="cc-search-clear" role="button" onClick={() => setQ('')}>
              <CloseIcon width={10} height={10} />
            </span>
          ) : null}
        </label>
        {error ? <div className="ob-err">{error}</div> : null}
        <div className="ob-pklist">
          {loading && !list.length ? <div className="ob-empty">{t('ob.pk.loading')}</div> : null}
          {!loading && !list.length && !error ? (
            <div className="ob-empty">{t('ob.pk.none')}</div>
          ) : null}
          {groups.map(([g, rs]) => (
            <div key={g} className="col g6">
              {g ? (
                <div className="ob-pkg">
                  <FolderIcon width={13} height={13} />
                  {t('ob.pk.group', { g })}
                </div>
              ) : null}
              {rs.map((r) => {
                const att = attachedOf(active, r.remote_id);
                const on = !!att || picked.has(`${active}:${r.remote_id}`);
                return (
                  <button
                    key={r.remote_id}
                    type="button"
                    className={`ob-pkr${on ? ' is-on' : ''}`}
                    disabled={!!att}
                    onClick={() => toggle(r.remote_id)}
                  >
                    <span className={`ob-pkc${on ? ' is-on' : ''}`}>
                      {on ? <CheckIcon width={11} height={11} /> : null}
                    </span>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="row g8">
                        <b className="f13">{r.name}</b>
                        <span className="mono f11 t3 ell">{r.path}</span>
                      </div>
                      <div className="f12 t3 ell" style={{ marginTop: 2 }}>
                        {[r.description, t('ob.pk.branch', { b: r.default_branch })]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                    {att ? (
                      <span
                        className={`cc-tag ${att.access_mode === 'read_write' ? 'cc-tag-g' : 'cc-tag-b'}`}
                        style={{ height: 20, fontSize: 11 }}
                      >
                        {t(`ob.pk.joined.${att.access_mode}`)}
                      </span>
                    ) : (
                      <span className="f11 t3">
                        {on ? t('ob.pk.selected') : t('ob.pk.unselected')}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </Drawer>
      {adding ? (
        <ConnectorDrawer
          calls={p.calls}
          plugins={p.plugins.filter((x) => x.category === 'code_source')}
          z={600}
          onClose={() => setAdding(false)}
          onSaved={(c) => {
            setAdding(false);
            p.onNewConnector(c);
            setActive(c.id);
          }}
        />
      ) : null}
    </>
  );
}

// ---------- tune a repository ----------

type Editable = 'default_branch' | 'package_manager' | 'build_command' | 'test_command';
const EDITABLE: Editable[] = ['default_branch', 'package_manager', 'build_command', 'test_command'];

export function RepoTuneDrawer(p: {
  calls: OnboardingCalls;
  repo: RepoRow;
  connector?: ConnectorRow;
  projects: ProjectRow[];
  build?: BuildState;
  startBuild: (projectId: string) => Promise<void>;
  onSaved: (r: RepoRow) => void;
  onClose: () => void;
}) {
  const t = useT();
  const r = p.repo;
  const eff = r.settings;
  const [v, setV] = useState<Record<Editable, string>>(() => ({
    default_branch: eff?.default_branch ?? '',
    package_manager: eff?.package_manager ?? '',
    build_command: eff?.build_command ?? '',
    test_command: eff?.test_command ?? '',
  }));
  const [busy, setBusy] = useState<'save' | 'build' | 'mode' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tile = repoTile(r.path);
  const overridden = (k: string) => r.manual_overrides.includes(k);
  const changed = EDITABLE.filter((k) => (eff?.[k] ?? '') !== v[k]);
  const project = p.projects.find((x) => x.id === r.project_id);
  const save = async (andBuild: boolean) => {
    setBusy(andBuild ? 'build' : 'save');
    setError(null);
    try {
      let row = r;
      if (changed.length) {
        const settings: Partial<RepoSettings> = {};
        for (const k of changed)
          (settings as Record<string, string | null>)[k] = v[k].trim() || null;
        if (settings.default_branch === null) delete settings.default_branch;
        row = await p.calls.updateRepo(r.id, { settings, rev: r.rev });
        p.onSaved(row);
      }
      if (andBuild && row.project_id) await p.startBuild(row.project_id);
      if (!andBuild) p.onClose();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(null);
    }
  };
  const reset = async (keys: string[]) => {
    setBusy('save');
    setError(null);
    try {
      const row = await p.calls.updateRepo(r.id, { reset_overrides: keys, rev: r.rev });
      p.onSaved(row);
      setV({
        default_branch: row.settings?.default_branch ?? '',
        package_manager: row.settings?.package_manager ?? '',
        build_command: row.settings?.build_command ?? '',
        test_command: row.settings?.test_command ?? '',
      });
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(null);
    }
  };
  const setMode = async (mode: RepoRow['access_mode']) => {
    setBusy('mode');
    setError(null);
    try {
      p.onSaved(await p.calls.updateRepo(r.id, { access_mode: mode, rev: r.rev }));
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(null);
    }
  };
  const setProject = async (projectId: string) => {
    setBusy('mode');
    setError(null);
    try {
      p.onSaved(await p.calls.updateRepo(r.id, { project_id: projectId, rev: r.rev }));
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(null);
    }
  };
  const badge = (k: Editable, guess: string) =>
    overridden(k) ? (
      <>
        <span className="ob-ov">{t('ob.tn.overridden')}</span>
        <button type="button" className="ob-rst" onClick={() => reset([k])}>
          {t('ob.tn.reset_one')}
        </button>
      </>
    ) : (
      <span className="ob-aid">
        <SparkleOutlineIcon width={10} height={10} />
        {guess}
      </span>
    );
  const field = (k: Editable, guess: string, mono = true) => (
    <div className="grow">
      <div className="ob-flab">
        {t(`ob.tn.${k}`)}
        {badge(k, guess)}
      </div>
      <label className={`ob-dinp is-md${overridden(k) || changed.includes(k) ? ' is-ov' : ''}`}>
        <input
          className={mono ? 'mono' : undefined}
          value={v[k]}
          onChange={(e) => setV({ ...v, [k]: e.target.value })}
        />
      </label>
    </div>
  );
  const at = r.probe.at ? new Date(r.probe.at) : null;
  return (
    <Drawer
      width={640}
      icon={
        <span
          className={`ob-mark ob-ic3 ${tile.tone}`}
          style={{ width: 38, height: 38, fontSize: 13 }}
        >
          {tile.label}
        </span>
      }
      title={
        <div className="row g8">
          <span style={{ fontSize: 17, fontWeight: 800 }}>{t('ob.tn.title')}</span>
          <span className={`cc-tag ${r.access_mode === 'read_write' ? 'cc-tag-g' : 'cc-tag-b'}`}>
            {t(`ob.tn.mode.${r.access_mode}`)}
          </span>
        </div>
      }
      sub={
        <span className="mono ell" style={{ display: 'block' }}>
          {[
            p.connector?.name,
            r.path,
            at
              ? t('ob.tn.probed_at', {
                  hm: `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`,
                })
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      }
      gap={13}
      onClose={p.onClose}
      footer={
        <>
          <button type="button" className="cc-btn cc-btn-lg cc-btn-sec" onClick={p.onClose}>
            {t('ob.cancel')}
          </button>
          <span className="grow" />
          <button
            type="button"
            className="cc-btn cc-btn-lg cc-btn-glass"
            disabled={!!busy || !changed.length}
            onClick={() => save(false)}
          >
            {t('ob.tn.save')}
          </button>
          <button
            type="button"
            className="cc-btn cc-btn-lg cc-btn-pri"
            disabled={!!busy || !r.project_id || p.build?.status === 'running'}
            onClick={() => save(true)}
          >
            <BoltIcon />
            {t('ob.tn.save_build')}
          </button>
        </>
      }
    >
      <div className="ob-tsec">
        <div className="ob-tsec-h">
          <span>{t('ob.tn.project')}</span>
          <span className="f11 t3" style={{ fontWeight: 400 }}>
            {t('ob.tn.project.sub')}
          </span>
        </div>
        <div className="row g10">
          <div className="grow">
            <div className="ob-flab">
              {t('ob.tn.project_name')}
              <span className="ob-aid">
                <SparkleOutlineIcon width={10} height={10} />
                {t('ob.tn.ai_guess')}
              </span>
            </div>
            <label className="ob-dinp is-md ob-dsel">
              <select
                value={r.project_id ?? ''}
                disabled={busy === 'mode' || !r.project_id}
                onChange={(e) => setProject(e.target.value)}
              >
                {project ? null : <option value="">{repoName(r)}</option>}
                {p.projects.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
              <ChevronDownIcon />
            </label>
          </div>
          <div style={{ width: 188, flex: 'none' }}>
            <div className="ob-flab">{t('ob.tn.mode')}</div>
            <label
              className={`ob-dinp is-md ob-dsel${r.access_mode === 'read_write' ? ' is-rw' : ''}`}
            >
              <PencilIcon />
              <select
                value={r.access_mode}
                disabled={busy === 'mode'}
                onChange={(e) => setMode(e.target.value as RepoRow['access_mode'])}
              >
                <option value="read_write">{t('ob.tn.mode.read_write.long')}</option>
                <option value="read_only">{t('ob.tn.mode.read_only')}</option>
              </select>
              <ChevronDownIcon />
            </label>
          </div>
        </div>
      </div>
      <div className="ob-tsec">
        <div className="ob-tsec-h">
          <span>{t('ob.tn.build')}</span>
          <span className="f11 t3" style={{ fontWeight: 400 }}>
            {t('ob.tn.build.sub')}
          </span>
          {r.manual_overrides.length ? (
            <button
              type="button"
              className="ob-lnk"
              style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 600 }}
              onClick={() => reset(r.manual_overrides)}
            >
              {t('ob.tn.reset_all')}
            </button>
          ) : null}
        </div>
        <div className="row g10">
          {field('default_branch', t('ob.tn.default_branch.guess'))}
          {field('test_command', t('ob.tn.ai_guess'))}
        </div>
        <div className="row g10">
          <div style={{ width: 170, flex: 'none' }}>
            <div className="ob-flab">
              {t('ob.tn.package_manager')}
              {badge('package_manager', t('ob.tn.auto'))}
            </div>
            <label className="ob-dinp is-md ob-dsel">
              <select
                className="mono"
                value={v.package_manager}
                onChange={(e) => setV({ ...v, package_manager: e.target.value })}
              >
                <option value="">—</option>
                {['pnpm', 'npm', 'yarn'].map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
              <ChevronDownIcon />
            </label>
          </div>
          {field('build_command', t('ob.tn.ai_guess'))}
        </div>
      </div>
      <div className="ob-tsec">
        <div className="ob-tsec-h">
          <span>{t('ob.tn.verify')}</span>
        </div>
        <div
          className="row g8 f12 t2"
          style={{ padding: '7px 10px', borderRadius: 10, background: 'var(--glass-2)' }}
        >
          <FileIcon />
          <span className="grow ell" title={r.probe.notes.join('\n')}>
            {eff
              ? t('ob.tn.verify.line', { how: t(`ob.verify.${eff.verify_strategy}`) })
              : r.probe.notes[0]}
          </span>
          {eff ? (
            <span className="cc-tag cc-tag-g" style={{ height: 19, fontSize: 10.5 }}>
              {t('ob.tn.verify.on')}
            </span>
          ) : null}
        </div>
      </div>
      {p.build ? <BuildLine b={p.build} cmd={eff?.build_command ?? ''} /> : null}
      {error ? <div className="ob-err">{error}</div> : null}
    </Drawer>
  );
}

function BuildLine({ b, cmd }: { b: BuildState; cmd: string }) {
  const t = useT();
  const s = Math.round((b.ms ?? 0) / 1000);
  if (b.status === 'running')
    return (
      <div className="ob-result is-run">
        <span className="cc-spinner cc-spinner-sm" />
        <span className="grow">{t('ob.tn.build.running')}</span>
      </div>
    );
  if (b.status === 'failed')
    return (
      <div className="ob-result is-bad">
        <AlertIcon />
        <span className="grow">
          {t('ob.tn.build.failed')}
          {b.error ? `\n${b.error}` : ''}
        </span>
      </div>
    );
  return (
    <div className="ob-result">
      <CheckIcon width={12} height={12} />
      <span className="grow">{t('ob.tn.build.ok', { cmd, m: Math.floor(s / 60), s: s % 60 })}</span>
    </div>
  );
}
