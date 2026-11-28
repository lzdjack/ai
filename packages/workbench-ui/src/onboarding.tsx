// First-run wizard (01 §11; approved designs PC-步骤器-1/2/4 and PC-首次使用步骤器). It fills the same
// data as "Settings → Connectors / Projects" (06 §10.3), so leaving it half-way loses nothing. A pure
// view: the app passes the API calls.
import type {
  ConnectorRow,
  EnvironmentRow,
  PluginInfo,
  ProjectRow,
  RepoRow,
} from '@cloudcraft/core-protocol';
import {
  AlertIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  ForkIcon,
  HelpChatIcon,
  InboxIcon,
  KeyIcon,
  LockIcon,
  MergeIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  ScrollArea,
  SearchIcon,
  ShieldIcon,
  SparkleOutlineIcon,
  useT,
} from '@cloudcraft/ui-kit';
import logo from '@cloudcraft/ui-kit/assets/app-logo.svg';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ConnectorDrawer, RepoPickerDrawer, RepoTuneDrawer } from './onboarding-drawers.tsx';
import {
  Mark,
  errText,
  repoName,
  repoTile,
  type BuildState,
  type OnboardingCalls,
} from './onboarding-parts.tsx';

export type { BuildState, OnboardingCalls } from './onboarding-parts.tsx';

const STEPS = ['s1', 's2', 's3', 's4'] as const;

export function OnboardingScreen(p: { calls: OnboardingCalls; onDone: () => void }) {
  const t = useT();
  const { calls } = p;
  const [step, setStep] = useState(0);
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [connectors, setConnectors] = useState<ConnectorRow[]>([]);
  const [repos, setRepos] = useState<RepoRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [envCount, setEnvCount] = useState(0);
  const [builds, setBuilds] = useState<Record<string, BuildState>>({});
  const [connectorDrawer, setConnectorDrawer] = useState<{
    category: string;
    pluginId?: string;
  } | null>(null);
  const [picker, setPicker] = useState<string | null>(null);
  const [tune, setTune] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [pl, cs, rs, ps] = await Promise.all([
        calls.plugins(),
        calls.connectors(),
        calls.repos(),
        calls.projects(),
      ]);
      setPlugins(pl);
      setConnectors(cs);
      setRepos(rs);
      setProjects(ps);
      setLoadError(null);
    } catch (e) {
      setLoadError(errText(e));
    }
  }, [calls]);
  useEffect(() => {
    void reload();
  }, [reload]);

  const startBuild = useCallback(
    async (projectId: string) => {
      const { flow_id } = await calls.trialBuild(projectId);
      setBuilds((b) => ({
        ...b,
        [projectId]: { flowId: flow_id, status: 'running', startedAt: Date.now() },
      }));
    },
    [calls],
  );
  // poll running trial builds every 2 s until they end
  const buildsRef = useRef(builds);
  buildsRef.current = builds;
  const anyRunning = Object.values(builds).some((b) => b.status === 'running');
  useEffect(() => {
    if (!anyRunning) return;
    const id = setInterval(async () => {
      for (const [pid, b] of Object.entries(buildsRef.current)) {
        if (b.status !== 'running') continue;
        try {
          const f = await calls.flow(b.flowId);
          if (f.status === 'running') continue;
          const node = f.nodes[f.nodes.length - 1];
          const out = node?.output as { builds?: { ms: number }[] } | null;
          setBuilds((x) => ({
            ...x,
            [pid]: {
              ...b,
              status: f.status === 'done' ? 'done' : 'failed',
              ms: out?.builds?.reduce((s, y) => s + y.ms, 0) ?? Date.now() - b.startedAt,
              error: node?.error ?? undefined,
            },
          }));
        } catch {
          // try again on the next tick
        }
      }
    }, 2000);
    return () => clearInterval(id);
  }, [anyRunning, calls]);

  const codeConnectors = connectors.filter((c) => c.category === 'code_source');
  const ticketConnectors = connectors.filter((c) => c.category === 'ticket_source');
  const rw = repos.filter((r) => r.access_mode === 'read_write');
  const ro = repos.filter((r) => r.access_mode === 'read_only');
  const done = [codeConnectors.length > 0, repos.length > 0, envCount > 0, false];
  const summary = [
    codeConnectors.map((c) => c.name).join(' · '),
    t('ob.s2.summary', { rw: rw.length, ro: ro.length }),
    t('ob.s3.summary', { n: envCount }),
    '',
  ];

  const tuneRepo = repos.find((r) => r.id === tune);
  const replaceRepo = (r: RepoRow) => setRepos((xs) => xs.map((x) => (x.id === r.id ? r : x)));

  return (
    <div className="ob-root">
      <div className="ob-top">
        <img src={logo} width={40} height={40} alt="" style={{ margin: -4 }} />
        <span className="ob-tt">
          <b>{t('app.name')}</b>
          <em>{t('app.name_latin')}</em>
        </span>
        <span className="grow" />
        <button type="button" className="ob-later" onClick={p.onDone}>
          {t('ob.later')}
        </button>
      </div>
      <div className="ob-wz glass">
        <aside className="ob-sl">
          <div className="f12 t3">{t('ob.first_use')}</div>
          <div style={{ fontSize: 21, fontWeight: 800, marginTop: 4 }}>{t('ob.title')}</div>
          <div
            className="f12 t2"
            style={{ marginTop: 6, lineHeight: 1.55, whiteSpace: 'pre-line' }}
          >
            {t('ob.subtitle')}
          </div>
          <div style={{ marginTop: 22 }}>
            {STEPS.map((s, i) => {
              const state = i === step ? 'is-cur' : i < step ? 'is-done' : 'is-todo';
              return (
                <div key={s} className={`ob-st ${state}`}>
                  <span className="ob-sc">
                    {state === 'is-done' ? <CheckIcon width={13} height={13} /> : i + 1}
                  </span>
                  <div>
                    <b>{t(`ob.${s}.name`)}</b>
                    <em>{state === 'is-done' && summary[i] ? summary[i] : t(`ob.${s}.desc`)}</em>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grow" />
          <div className="ob-why">
            <div className="ob-wh">
              {step === 0 ? (
                <KeyIcon style={{ color: 'var(--purple)' }} />
              ) : step === 2 ? (
                <ShieldIcon style={{ color: 'var(--purple)' }} />
              ) : (
                <SparkleOutlineIcon style={{ color: 'var(--purple)' }} />
              )}
              {t(`ob.${STEPS[step]}.why.title`)}
            </div>
            {t(`ob.${STEPS[step]}.why.body`)}
          </div>
          <div className="row f12 t3" style={{ marginBottom: 8 }}>
            <span className="grow">{t('ob.progress', { n: step + 1 })}</span>
            <span>{t('ob.progress_done', { n: done.slice(0, step).filter(Boolean).length })}</span>
          </div>
          <div className="ob-pbar">
            <i style={{ width: `${(step + 1) * 25}%` }} />
          </div>
        </aside>
        <section className="ob-fm">
          {loadError ? (
            <div className="ob-fb">
              <div className="ob-err">{loadError}</div>
            </div>
          ) : step === 0 ? (
            <StepConnectors
              plugins={plugins}
              code={codeConnectors}
              tickets={ticketConnectors}
              repos={repos}
              onAdd={(category, pluginId) => setConnectorDrawer({ category, pluginId })}
              onPick={(id) => {
                setStep(1);
                setPicker(id);
              }}
              onNext={() => setStep(1)}
            />
          ) : step === 1 ? (
            <StepRepos
              connectors={codeConnectors}
              plugins={plugins}
              repos={repos}
              projects={projects}
              calls={calls}
              onChanged={(r) => {
                replaceRepo(r);
                void calls.projects().then(setProjects);
              }}
              onPick={(id) => setPicker(id)}
              onTune={(id) => setTune(id)}
              onBack={() => setStep(0)}
              onNext={() => setStep(2)}
            />
          ) : step === 2 ? (
            <StepEnvironments
              calls={calls}
              projects={projects.filter((x) => rw.some((r) => r.project_id === x.id))}
              onCount={setEnvCount}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          ) : (
            <StepHealth
              connectors={connectors}
              repos={repos}
              projects={projects}
              envCount={envCount}
              builds={builds}
              startBuild={startBuild}
              onBack={() => setStep(2)}
              onDone={p.onDone}
            />
          )}
        </section>
      </div>
      {connectorDrawer ? (
        <ConnectorDrawer
          calls={calls}
          plugins={plugins.filter((x) => x.category === connectorDrawer.category)}
          initialPlugin={connectorDrawer.pluginId}
          onClose={() => setConnectorDrawer(null)}
          onSaved={(c) => {
            setConnectorDrawer(null);
            setConnectors((xs) => [...xs, c]);
          }}
        />
      ) : null}
      {picker !== null ? (
        <RepoPickerDrawer
          calls={calls}
          plugins={plugins}
          connectors={codeConnectors}
          repos={repos}
          initialConnector={picker || codeConnectors[0]?.id}
          onNewConnector={async (c) => setConnectors((xs) => [...xs, c])}
          onClose={() => setPicker(null)}
          onAttached={(rows) => {
            setPicker(null);
            setRepos((xs) => [...xs.filter((x) => !rows.some((r) => r.id === x.id)), ...rows]);
          }}
        />
      ) : null}
      {tuneRepo ? (
        <RepoTuneDrawer
          calls={calls}
          repo={tuneRepo}
          connector={connectors.find((c) => c.id === tuneRepo.connector_id)}
          projects={projects.filter((x) => repos.some((r) => r.project_id === x.id))}
          build={tuneRepo.project_id ? builds[tuneRepo.project_id] : undefined}
          startBuild={startBuild}
          onSaved={replaceRepo}
          onClose={() => setTune(null)}
        />
      ) : null}
    </div>
  );
}

function Head(p: { step: number; ask: string }) {
  const t = useT();
  const s = STEPS[p.step];
  return (
    <div className="row g10">
      <div className="grow">
        <div className="ob-eyebrow">{t(`ob.${s}.eyebrow`)}</div>
        <div className="ob-h1">{t(`ob.${s}.h1`)}</div>
        <div className="f13 t2" style={{ marginTop: 5 }}>
          {t(`ob.${s}.lead`)}
        </div>
      </div>
      <span className="ob-chip" title={t('ob.ask_ai.soon')}>
        <SparkleOutlineIcon />
        {p.ask}
      </span>
    </div>
  );
}

function Footer(p: { children: ReactNode }) {
  return <div className="ob-ff">{p.children}</div>;
}

const BackButton = (p: { onClick: () => void }) => (
  <button type="button" className="ob-bigb ob-sec" onClick={p.onClick}>
    <ChevronLeftIcon />
    {useT()('ob.back')}
  </button>
);

// ---------- step 1: connectors ----------

function StepConnectors(p: {
  plugins: PluginInfo[];
  code: ConnectorRow[];
  tickets: ConnectorRow[];
  repos: RepoRow[];
  onAdd: (category: string, pluginId?: string) => void;
  onPick: (connectorId: string) => void;
  onNext: () => void;
}) {
  const t = useT();
  const codePlugins = p.plugins.filter((x) => x.category === 'code_source');
  const ticketPlugins = p.plugins.filter((x) => x.category === 'ticket_source');
  const card = (c: ConnectorRow, ticket: boolean) => {
    const plugin = p.plugins.find((x) => x.id === c.plugin_id);
    const url = typeof c.config.base_url === 'string' ? c.config.base_url : '';
    const ok = c.status === 'enabled';
    const picked = p.repos.filter((r) => r.connector_id === c.id).length;
    return (
      <div key={c.id} className="ob-ccard">
        <div className="row g10">
          <Mark plugin={plugin} name={c.name} size={34} />
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="row g6">
              <b className="f14">{c.name}</b>
              <span className="cc-tag cc-tag-n" style={{ height: 18, fontSize: 10.5 }}>
                {t('ob.s1.shared')}
              </span>
            </div>
            <div className="mono f12 t3 ell" style={{ marginTop: 2 }}>
              {url}
            </div>
          </div>
          {ok ? (
            <span className="ob-okpill">
              <CheckIcon width={14} height={14} />
              {t('ob.s1.verified')}
            </span>
          ) : (
            <span className="ob-badpill">{t('ob.s1.needs_auth')}</span>
          )}
        </div>
        <div className="ob-cmeta">
          {ticket ? <InboxIcon /> : <ShieldIcon />}
          <span className="ell">{t('ob.s1.credential', { hint: c.credential_hint })}</span>
        </div>
        <div className="ob-cfoot">
          <span>{ticket ? '' : t('ob.s1.picked', { n: picked })}</span>
          {ticket ? null : (
            <button type="button" className="ob-act" onClick={() => p.onPick(c.id)}>
              {t('ob.s1.pick')}
            </button>
          )}
        </div>
      </div>
    );
  };
  return (
    <>
      <div className="ob-fb">
        <Head step={0} ask={t('ob.s1.ask')} />
        <div className="ob-sech">
          <b>{t('ob.s1.code')}</b>
          <span className="cc-tag cc-tag-b" style={{ height: 19, fontSize: 10.5 }}>
            {t('ob.s1.code.min')}
          </span>
          <span className="ob-sub">{t('ob.s1.code.sub')}</span>
        </div>
        <div className="ob-cgrid">
          {p.code.map((c) => card(c, false))}
          {p.code.length % 2 === 0 ? (
            <AddCard
              title={t('ob.s1.code.add')}
              body={t('ob.s1.code.add_body')}
              onClick={() => p.onAdd('code_source')}
            />
          ) : null}
        </div>
        {p.code.length && codePlugins.length ? (
          <div className="ob-qadd">
            <span className="f12 t3" style={{ whiteSpace: 'nowrap' }}>
              {t('ob.s1.more')}
            </span>
            {codePlugins.map((pl) => (
              <button
                key={pl.id}
                type="button"
                className="ob-qbtn"
                onClick={() => p.onAdd('code_source', pl.id)}
              >
                <Mark plugin={pl} name={pl.name} size={17} />+ {pl.name}
              </button>
            ))}
          </div>
        ) : null}
        <div className="ob-sech" style={{ marginTop: 18 }}>
          <b>{t('ob.s1.tickets')}</b>
          <span className="cc-tag cc-tag-n" style={{ height: 19, fontSize: 10.5 }}>
            {t('ob.s1.tickets.optional')}
          </span>
          <span className="ob-sub">{t('ob.s1.tickets.sub')}</span>
        </div>
        <div className="ob-cgrid">
          {p.tickets.map((c) => card(c, true))}
          <AddCard
            title={t('ob.s1.tickets.add')}
            body={ticketPlugins.length ? t('ob.s1.tickets.add_body') : t('ob.s1.tickets.none')}
            onClick={ticketPlugins.length ? () => p.onAdd('ticket_source') : undefined}
            tags={ticketPlugins.map((pl) => ({ id: pl.id, name: pl.name }))}
            onTag={(id) => p.onAdd('ticket_source', id)}
          />
        </div>
        <div className="ob-note" style={{ marginTop: 'auto', marginBottom: 14 }}>
          <LockIcon width={15} height={15} />
          <span>
            <b>{t('ob.s1.note.title')}</b>
            {t('ob.s1.note.body')}
          </span>
        </div>
      </div>
      <Footer>
        <span className="ob-stat is-g">
          <CheckIcon width={12} height={12} />
          {t('ob.s1.stat.code', { n: p.code.filter((c) => c.status === 'enabled').length })}
        </span>
        <span className="ob-stat is-b">
          <InboxIcon width={12} height={12} />
          {t('ob.s1.stat.tickets', { n: p.tickets.length })}
        </span>
        <span className="f12 t3">{t('ob.s1.next_hint')}</span>
        <span className="grow" />
        <button
          type="button"
          className="ob-bigb ob-pri"
          disabled={!p.code.length}
          onClick={p.onNext}
        >
          {t('ob.s1.next')}
          <ChevronRightIcon />
        </button>
      </Footer>
    </>
  );
}

function AddCard(p: {
  title: string;
  body: string;
  onClick?: () => void;
  tags?: { id: string; name: string }[];
  onTag?: (id: string) => void;
}) {
  return (
    <div
      className="ob-ccard is-add"
      role={p.onClick ? 'button' : undefined}
      onClick={p.onClick}
      style={p.onClick ? { cursor: 'pointer' } : undefined}
    >
      <div className="row g8" style={{ color: 'var(--text)' }}>
        <PlusIcon width={16} height={16} />
        <b className="f14">{p.title}</b>
      </div>
      <div className="f12 t3" style={{ lineHeight: 1.55 }}>
        {p.body}
      </div>
      {p.tags?.length ? (
        <div className="row g6" style={{ marginTop: 2 }}>
          {p.tags.map((x) => (
            <span
              key={x.id}
              className="cc-tag cc-tag-b"
              style={{ height: 20, fontSize: 11, cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                p.onTag?.(x.id);
              }}
            >
              + {x.name}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ---------- step 2: repositories ----------

function StepRepos(p: {
  connectors: ConnectorRow[];
  plugins: PluginInfo[];
  repos: RepoRow[];
  projects: ProjectRow[];
  calls: OnboardingCalls;
  onChanged: (r: RepoRow) => void;
  onPick: (connectorId: string) => void;
  onTune: (repoId: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const t = useT();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'read_write' | 'read_only'>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; text: string } | null>(null);
  const rw = p.repos.filter((r) => r.access_mode === 'read_write').length;
  const ro = p.repos.length - rw;
  const kw = q.trim().toLowerCase();
  const visible = (r: RepoRow, c: ConnectorRow) => {
    if (filter !== 'all' && r.access_mode !== filter) return false;
    if (!kw) return true;
    const project = p.projects.find((x) => x.id === r.project_id)?.name ?? '';
    return [r.path, project, c.name].some((s) => s.toLowerCase().includes(kw));
  };
  const setMode = async (r: RepoRow, mode: RepoRow['access_mode']) => {
    if (r.access_mode === mode) return;
    setBusy(r.id);
    setError(null);
    try {
      p.onChanged(await p.calls.updateRepo(r.id, { access_mode: mode, rev: r.rev }));
    } catch (e) {
      setError({ id: r.id, text: errText(e) });
    } finally {
      setBusy(null);
    }
  };
  return (
    <>
      <div className="ob-fb">
        <Head step={1} ask={t('ob.s2.ask')} />
        <div className="ob-ptbar">
          <button type="button" className="ob-pickbtn" onClick={() => p.onPick('')}>
            <PlusIcon width={14} height={14} />
            {t('ob.s2.pick')}
          </button>
          <label className="ob-srch">
            <SearchIcon width={14} height={14} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('ob.s2.search', { n: p.repos.length })}
            />
          </label>
          {(
            [
              ['all', t('ob.s2.f.all'), p.repos.length],
              ['read_write', t('ob.s2.f.rw'), rw],
              ['read_only', t('ob.s2.f.ro'), ro],
            ] as const
          ).map(([k, label, n]) => (
            <button
              key={k}
              type="button"
              className={`ob-fchip${filter === k ? ' is-on' : ''}`}
              onClick={() => setFilter(k)}
            >
              {label}
              <em>{n}</em>
            </button>
          ))}
        </div>
        <ScrollArea style={{ flex: 1, minHeight: 0, marginTop: 11, marginRight: -12 }}>
          <div className="ob-plist" style={{ paddingRight: 12, paddingBottom: 10 }}>
            {!p.repos.length ? <div className="ob-empty">{t('ob.s2.empty')}</div> : null}
            {p.connectors.map((c) => {
              const mine = p.repos.filter((r) => r.connector_id === c.id);
              const shown = mine.filter((r) => visible(r, c));
              if (!mine.length || (!shown.length && (kw || filter !== 'all'))) return null;
              const url = typeof c.config.base_url === 'string' ? c.config.base_url : '';
              return (
                <div key={c.id} className="ob-sgrp">
                  <div className="ob-sgh">
                    <Mark
                      plugin={p.plugins.find((x) => x.id === c.plugin_id)}
                      name={c.name}
                      size={18}
                    />
                    <b>{c.name}</b>
                    <span className="mono ob-surl">{url}</span>
                    <span className="ob-scnt">{t('ob.s2.group_count', { n: mine.length })}</span>
                    <button type="button" className="ob-sadd" onClick={() => p.onPick(c.id)}>
                      {t('ob.s2.pick_here')}
                    </button>
                  </div>
                  {shown.map((r) => (
                    <RepoLine
                      key={r.id}
                      repo={r}
                      busy={busy === r.id}
                      error={error?.id === r.id ? error.text : null}
                      onMode={(m) => setMode(r, m)}
                      onTune={() => p.onTune(r.id)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </ScrollArea>
        <div className="ob-note" style={{ marginBottom: 10, padding: '8px 13px' }}>
          <ShieldIcon width={15} height={15} />
          <span>
            <b>{t('ob.s2.note.title')}</b>
            {t('ob.s2.note.body', { n: p.repos.length })}
          </span>
        </div>
      </div>
      <Footer>
        <BackButton onClick={p.onBack} />
        <span className="ob-stat is-g">
          <PencilIcon />
          {t('ob.s2.stat.rw', { n: rw })}
        </span>
        <span className="ob-stat is-b">
          <EyeIcon width={12} height={12} />
          {t('ob.s2.stat.ro', { n: ro })}
        </span>
        <span className="grow" />
        <button
          type="button"
          className="ob-bigb ob-pri"
          disabled={!p.repos.length}
          onClick={p.onNext}
        >
          {t('ob.s2.next')}
          <ChevronRightIcon />
        </button>
      </Footer>
    </>
  );
}

function RepoLine(p: {
  repo: RepoRow;
  busy: boolean;
  error: string | null;
  onMode: (m: RepoRow['access_mode']) => void;
  onTune: () => void;
}) {
  const t = useT();
  const r = p.repo;
  const writable = r.access_mode === 'read_write';
  const tile = repoTile(r.path);
  const s = r.settings;
  const incomplete = writable && r.probe.state === 'done' && !s?.build_command;
  return (
    <div className={`ob-prow ${writable ? 'is-rw' : 'is-ro'}`}>
      <span className={`ob-pic ${tile.tone}`}>{tile.label}</span>
      <div className="ob-pinfo">
        <div className="ob-ptop">
          <b>{repoName(r)}</b>
          <span className="ob-src-pill">
            <span className="mono">{r.path}</span>
          </span>
          {writable ? (
            r.probe.state === 'done' && !incomplete ? (
              <span className="ob-okchip">
                <CheckIcon width={12} height={12} />
                {t('ob.s2.probed')}
              </span>
            ) : r.probe.state === 'pending' ? (
              <span className="ob-okchip" style={{ color: 'var(--ink-teal)' }}>
                {t('ob.s2.probing')}
              </span>
            ) : (
              <span className="ob-warnchip">
                <AlertIcon />
                {t('ob.s2.needs_tune')}
              </span>
            )
          ) : null}
        </div>
        <div className="ob-pmeta">
          {writable ? (
            <>
              <span className="ob-ai-bdg">
                <SparkleOutlineIcon width={11} height={11} />
                {t('ob.s2.ai_guess')}
              </span>
              <span className="ell">
                {s ? (
                  <>
                    <span className="mono">{s.default_branch}</span>
                    {s.build_command ? (
                      <>
                        {' · '}
                        <span className="mono">{s.build_command}</span>
                      </>
                    ) : null}
                    {' · '}
                    {t(`ob.verify.${s.verify_strategy}`)}
                  </>
                ) : (
                  (r.probe.notes[0] ?? '')
                )}
              </span>
              <button type="button" className="ob-tune" onClick={p.onTune}>
                {t('ob.s2.tune')}
              </button>
            </>
          ) : (
            <>
              <span className="ob-ro-bdg">
                <LockIcon width={11} height={11} />
                {t('ob.s2.ro_badge')}
              </span>
              <span className="ell">{p.error ?? t('ob.s2.ro_desc')}</span>
            </>
          )}
        </div>
        {writable && p.error ? <div className="ob-err">{p.error}</div> : null}
      </div>
      <div className="ob-pseg" role="radiogroup">
        <button
          type="button"
          role="radio"
          aria-checked={!writable}
          className={writable ? undefined : 'is-ro'}
          disabled={p.busy}
          onClick={() => p.onMode('read_only')}
        >
          <EyeIcon width={12} height={12} />
          {t('ob.s2.ro')}
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={writable}
          className={writable ? 'is-rw' : undefined}
          disabled={p.busy}
          onClick={() => p.onMode('read_write')}
        >
          <PencilIcon />
          {p.busy ? t('ob.s2.switching') : t('ob.s2.rw')}
        </button>
      </div>
    </div>
  );
}

// ---------- step 3: environments ----------

const TIERS = ['test_gate', 'dev', 'production'] as const;

function StepEnvironments(p: {
  calls: OnboardingCalls;
  projects: ProjectRow[];
  onCount: (n: number) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const t = useT();
  const [project, setProject] = useState(p.projects[0]?.id ?? '');
  const [envs, setEnvs] = useState<Record<string, EnvironmentRow[]>>({});
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', entry_url: '', env_tier: 'test_gate' });
  const [error, setError] = useState<string | null>(null);
  const { calls, onCount } = p;
  const ids = p.projects.map((x) => x.id).join(',');
  useEffect(() => {
    let live = true;
    void Promise.all(
      ids
        .split(',')
        .filter(Boolean)
        .map(async (id) => [id, await calls.environments(id)] as const),
    ).then((rows) => {
      if (!live) return;
      setEnvs(Object.fromEntries(rows));
      onCount(rows.reduce((s, [, e]) => s + e.length, 0));
    });
    return () => {
      live = false;
    };
  }, [ids, calls, onCount]);
  const list = envs[project] ?? [];
  const add = async () => {
    setError(null);
    try {
      const code =
        `${form.env_tier === 'test_gate' ? 'test' : form.env_tier === 'production' ? 'prod' : 'dev'}` +
        (list.some((e) => e.env_tier === form.env_tier) ? `-${list.length + 1}` : '');
      const e = await calls.createEnvironment(project, { ...form, env_code: code });
      const next = { ...envs, [project]: [...list, e] };
      setEnvs(next);
      onCount(Object.values(next).reduce((s, x) => s + x.length, 0));
      setAdding(false);
      setForm({ name: '', entry_url: '', env_tier: 'test_gate' });
    } catch (x) {
      setError(errText(x));
    }
  };
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
                <div className="cc-seg">
                  {p.projects.map((x) => (
                    <span
                      key={x.id}
                      className={x.id === project ? 'on' : undefined}
                      onClick={() => setProject(x.id)}
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
              {list.map((e) => (
                <div key={e.id} className="ob-env">
                  <div className="row g6">
                    <b>{e.name}</b>
                    <span
                      className={`cc-tag ${e.env_tier === 'production' ? 'cc-tag-o' : 'cc-tag-b'}`}
                    >
                      {t(`ob.tier.${e.env_tier}`)}
                    </span>
                  </div>
                  <div className="mono f12 t2 ell" style={{ marginTop: 6 }}>
                    {e.entry_url.replace(/^https?:\/\//, '')}
                  </div>
                  <div className="f12 t3" style={{ marginTop: 3 }}>
                    {e.env_code}
                  </div>
                </div>
              ))}
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
                </label>
              </div>
              <div className="row g8">
                <button
                  type="button"
                  className="cc-btn cc-btn-md cc-btn-pri"
                  disabled={!form.name.trim() || !/^https?:\/\//.test(form.entry_url)}
                  onClick={add}
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
          {error ? <div className="ob-err">{error}</div> : null}
          <div className="ob-note" style={{ marginTop: 10, padding: '8px 12px' }}>
            <MergeIcon />
            <span>
              <b>{t('ob.s3.rule.title')}</b>
              {t('ob.s3.rule.body')}
            </span>
          </div>
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
    </>
  );
}

// ---------- step 4: health check ----------

const secs = (ms: number) => {
  const s = Math.round(ms / 1000);
  return s >= 60 ? { m: Math.floor(s / 60), s: s % 60 } : { m: 0, s };
};

function StepHealth(p: {
  connectors: ConnectorRow[];
  repos: RepoRow[];
  projects: ProjectRow[];
  envCount: number;
  builds: Record<string, BuildState>;
  startBuild: (projectId: string) => Promise<void>;
  onBack: () => void;
  onDone: () => void;
}) {
  const t = useT();
  const rw = p.repos.filter((r) => r.access_mode === 'read_write');
  const ro = p.repos.filter((r) => r.access_mode === 'read_only');
  const targets = useMemo(
    () => [...new Set(rw.map((r) => r.project_id).filter((x): x is string => !!x))],
    [rw],
  );
  const [startError, setStartError] = useState<string | null>(null);
  const started = useRef(false);
  const { startBuild, builds } = p;
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    for (const id of targets)
      if (!builds[id] || builds[id].status === 'failed')
        startBuild(id).catch((e) => setStartError(errText(e)));
  }, [targets, builds, startBuild]);
  const bs = targets.map((id) => builds[id]).filter((b): b is BuildState => !!b);
  const running =
    !startError && (bs.length < targets.length || bs.some((b) => b.status === 'running'));
  const failed = bs.find((b) => b.status === 'failed');
  const probeBad = rw.filter((r) => r.probe.state !== 'done' || !r.settings?.build_command);
  const connOk = p.connectors.every((c) => c.status === 'enabled');
  const total = bs.reduce((s, b) => s + (b.ms ?? 0), 0);
  const state = startError || failed ? 'bad' : running ? 'run' : 'ok';
  const rows: { mark: 'ok' | 'warn' | 'off' | 'run'; text: string; side: string }[] = [
    {
      mark: connOk ? 'ok' : 'warn',
      text: t('ob.s4.c.connectors', {
        names: p.connectors.map((c) => c.name).join(t('ob.list_sep')),
      }),
      side: connOk ? t('ob.s4.c.connectors.ok') : t('ob.s4.c.connectors.bad'),
    },
    {
      mark: !rw.length ? 'off' : failed || startError ? 'warn' : running ? 'run' : 'ok',
      text: t('ob.s4.c.rw', { n: rw.length }),
      side: !rw.length
        ? t('ob.s4.c.rw.none')
        : failed || startError
          ? t('ob.s4.c.rw.failed')
          : running
            ? t('ob.s4.c.rw.running')
            : t('ob.time', secs(total)),
    },
    {
      mark: ro.length ? 'ok' : 'off',
      text: t('ob.s4.c.ro', { n: ro.length }),
      side: t('ob.s4.c.ro.side'),
    },
    {
      mark: probeBad.length ? 'warn' : 'ok',
      text: t('ob.s4.c.probe'),
      side: probeBad.length
        ? t('ob.s4.c.probe.bad', { n: probeBad.length })
        : t('ob.s4.c.probe.ok'),
    },
    {
      mark: p.envCount ? 'ok' : 'off',
      text: t('ob.s4.c.envs', { n: p.envCount }),
      side: p.envCount ? t('ob.s4.c.envs.ok') : t('ob.s4.c.envs.none'),
    },
    { mark: 'off', text: t('ob.s4.c.plugins'), side: t('ob.s4.c.plugins.side') },
  ];
  return (
    <>
      <div className="ob-fb">
        <div className="row g10">
          <div className="grow">
            <div className="ob-eyebrow">{t('ob.s4.eyebrow')}</div>
            <div className="ob-h1">{t(`ob.s4.h1.${state}`)}</div>
            <div className="f13 t2" style={{ marginTop: 5 }}>
              {t('ob.s4.lead')}
            </div>
          </div>
          <span className="ob-chip" title={t('ob.ask_ai.soon')}>
            <SparkleOutlineIcon />
            {t('ob.s4.ask')}
          </span>
        </div>
        <div className={`ob-big${state === 'ok' ? '' : ` is-${state}`}`} style={{ marginTop: 18 }}>
          <span
            className={`ob-ck ${state === 'ok' ? 'is-ok' : state === 'bad' ? 'is-warn' : 'is-run'}`}
            style={{ width: 44, height: 44 }}
          >
            {state === 'ok' ? (
              <CheckIcon width={22} height={22} />
            ) : state === 'bad' ? (
              <AlertIcon width={22} height={22} />
            ) : (
              <span className="cc-spinner" />
            )}
          </span>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="f16 w7">{t(`ob.s4.big.${state}`)}</div>
            <div
              className="f13 t2"
              style={{ marginTop: 3, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
            >
              {startError ??
                failed?.error ??
                (state === 'ok'
                  ? t('ob.s4.big.ok.sub', secs(total))
                  : t('ob.s4.big.run.sub', { n: targets.length }))}
            </div>
          </div>
        </div>
        <div className="row g12" style={{ marginTop: 14, alignItems: 'flex-start' }}>
          <div className="ob-obx grow" style={{ padding: '6px 16px' }}>
            {rows.map((r) => (
              <div key={r.text} className="ob-chk">
                <span className={`ob-ck is-${r.mark}`}>
                  {r.mark === 'ok' ? (
                    <CheckIcon width={12} height={12} />
                  ) : r.mark === 'warn' ? (
                    <AlertIcon />
                  ) : r.mark === 'run' ? (
                    <span className="cc-spinner cc-spinner-sm" />
                  ) : (
                    <MinusIcon />
                  )}
                </span>
                <span className="grow">{r.text}</span>
                <span
                  className="f12"
                  style={{ color: r.mark === 'warn' ? 'var(--ink-orange)' : 'var(--text-3)' }}
                >
                  {r.side}
                </span>
              </div>
            ))}
          </div>
          <div className="ob-obx" style={{ width: 276, flex: 'none' }}>
            <div className="f13 w7">{t('ob.s4.after.title')}</div>
            <div className="f12 t2" style={{ marginTop: 6, lineHeight: 1.6 }}>
              {t('ob.s4.after.body')}
            </div>
            <div className="col g6" style={{ marginTop: 10 }}>
              {p.projects
                .filter((x) => targets.includes(x.id))
                .map((x) => (
                  <div key={x.id} className="ob-tk">
                    <ForkIcon />
                    <span className="grow ell">{x.name}</span>
                  </div>
                ))}
            </div>
            <div
              className="f12 t3"
              style={{
                marginTop: 12,
                paddingTop: 10,
                borderTop: '1px solid var(--hair)',
                lineHeight: 1.55,
              }}
            >
              {t('ob.s4.after.more')}
            </div>
          </div>
        </div>
      </div>
      <Footer>
        <BackButton onClick={p.onBack} />
        <span className="grow" />
        <span className="f13 t3" style={{ marginRight: 6 }}>
          {t('ob.s4.hint')}
        </span>
        <button type="button" className="ob-bigb ob-pri" onClick={p.onDone}>
          {t('ob.s4.start')}
          <ChevronRightIcon />
        </button>
      </Footer>
    </>
  );
}
