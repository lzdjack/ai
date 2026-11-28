// Sign-in and sign-up (01 §9; approved designs PC-登录 / PC-注册). Pure views: the app passes the
// calls (login, request a code, register) and shows what they return; errors stay on the field
// ("邮箱或密码不对" under the password box), never a dialog.
import {
  EnterIcon,
  EyeIcon,
  LayersIcon,
  LockIcon,
  MailIcon,
  PlugIcon,
  ShieldCheckIcon,
  SparkFillIcon,
  UserIcon,
  CheckIcon,
  useT,
} from '@cloudcraft/ui-kit';
import logo from '@cloudcraft/ui-kit/assets/app-logo.svg';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

export interface AuthCalls {
  login(email: string, password: string, remember: boolean): Promise<void>;
  requestCode(email: string): Promise<void>;
  register(v: {
    email: string;
    code: string;
    displayName: string;
    password: string;
    workspaceName: string;
  }): Promise<void>;
}

/** An error the call threw: `code` is the server's ApiError code, `message` already in the user's language. */
export interface AuthError {
  code: string;
  message: string;
}

function Shell(p: { children: ReactNode; footer: string }) {
  return (
    <div className="au-root">
      <div className="au-ring" style={{ width: 620, height: 620 }} />
      <div className="au-ring" style={{ width: 900, height: 900 }} />
      <div className="au-aura" style={{ width: 420, height: 420 }} />
      <span className="au-ver">{useT()('auth.version')}</span>
      <div className="au-card glass">{p.children}</div>
      <div className="au-ft">
        <span className="pill glass">
          <PlugIcon />
          {p.footer}
        </span>
      </div>
    </div>
  );
}

function Tabs(p: {
  mode: 'login' | 'register';
  onMode: (m: 'login' | 'register') => void;
  top: number;
}) {
  const t = useT();
  return (
    <div style={{ marginTop: p.top }}>
      <div className="cc-seg cc-seg-lg au-seg" role="tablist">
        <span
          role="tab"
          aria-selected={p.mode === 'login'}
          className={p.mode === 'login' ? 'on' : undefined}
          onClick={() => p.onMode('login')}
        >
          <b className="au-bd is-in">
            <EnterIcon />
          </b>
          {t('auth.login')}
        </span>
        <span
          role="tab"
          aria-selected={p.mode === 'register'}
          className={p.mode === 'register' ? 'on' : undefined}
          onClick={() => p.onMode('register')}
        >
          <b className="au-bd is-up">
            <SparkFillIcon />
          </b>
          {t('auth.register')}
        </span>
      </div>
    </div>
  );
}

const errOf = (e: unknown): AuthError => {
  const x = e as Partial<AuthError>;
  return { code: x.code ?? 'common.internal', message: x.message ?? String(e) };
};

export function AuthScreen(p: {
  calls: AuthCalls;
  initialMode?: 'login' | 'register';
  defaultEmail?: string;
}) {
  const [mode, setMode] = useState(p.initialMode ?? 'login');
  return mode === 'login' ? (
    <LoginCard calls={p.calls} onMode={setMode} defaultEmail={p.defaultEmail} />
  ) : (
    <RegisterCard calls={p.calls} onMode={setMode} />
  );
}

function LoginCard(p: {
  calls: AuthCalls;
  onMode: (m: 'login' | 'register') => void;
  defaultEmail?: string;
}) {
  const t = useT();
  const [email, setEmail] = useState(p.defaultEmail ?? '');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<AuthError | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await p.calls.login(email, password, remember);
    } catch (x) {
      setError(errOf(x));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell footer={t('auth.footer.login')}>
      <form onSubmit={submit} style={{ display: 'contents' }}>
        <div className="au-brand">
          <img src={logo} width={96} height={96} alt="" style={{ margin: '-8px 0 -4px' }} />
          <div className="au-nm" style={{ fontSize: 26 }}>
            {t('app.name')}
          </div>
          <div className="au-sub" style={{ fontSize: 12, marginTop: 6 }}>
            {t('app.name_latin')}
          </div>
        </div>
        <Tabs mode="login" onMode={p.onMode} top={24} />
        <div style={{ marginTop: 18 }}>
          <div className="au-lab">{t('auth.email')}</div>
          <label className="au-inp">
            <MailIcon />
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.email.placeholder')}
            />
          </label>
        </div>
        <div style={{ marginTop: 14 }}>
          <div className="au-lab">{t('auth.password')}</div>
          <label className={`au-inp${error?.code === 'auth.login_failed' ? ' is-error' : ''}`}>
            <LockIcon />
            <input
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="au-eye"
              aria-label={t('auth.password.show')}
              onClick={() => setShow((s) => !s)}
            >
              <EyeIcon />
            </button>
          </label>
          {error ? (
            <div className="au-err">
              {error.code === 'auth.login_failed' ? t('auth.login_failed') : error.message}
            </div>
          ) : null}
        </div>
        <div className="row" style={{ marginTop: 8, fontSize: 13, minHeight: 'var(--m-touch)' }}>
          <button
            type="button"
            className={`au-ck${remember ? ' is-on' : ''}`}
            aria-pressed={remember}
            onClick={() => setRemember((r) => !r)}
          >
            {remember ? <CheckIcon width={14} height={14} /> : null}
          </button>
          <span className="t2" style={{ marginLeft: 7 }}>
            {t('auth.remember')}
          </span>
          <span className="grow" />
          <button type="button" className="au-lnk">
            {t('auth.forgot')}
          </button>
        </div>
        <button type="submit" className="au-btn" style={{ marginTop: 20 }} disabled={busy}>
          {t('auth.login')}
        </button>
        <div className="f12 t3" style={{ marginTop: 12, textAlign: 'center' }}>
          {t('auth.login.note')}
        </div>
      </form>
    </Shell>
  );
}

function RegisterCard(p: { calls: AuthCalls; onMode: (m: 'login' | 'register') => void }) {
  const t = useT();
  const [v, setV] = useState({
    email: '',
    code: '',
    displayName: '',
    password: '',
    workspaceName: '',
  });
  const [wait, setWait] = useState(0);
  const [error, setError] = useState<AuthError | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!wait) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) =>
    setV((x) => ({ ...x, [k]: e.target.value }));
  const sendCode = async () => {
    setError(null);
    try {
      await p.calls.requestCode(v.email);
      setWait(60);
    } catch (x) {
      setError(errOf(x));
    }
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await p.calls.register(v);
    } catch (x) {
      setError(errOf(x));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell footer={t('auth.footer.register')}>
      <form onSubmit={submit} style={{ display: 'contents' }}>
        <div className="au-brand">
          <img src={logo} width={84} height={84} alt="" style={{ margin: '-6px 0 -4px' }} />
          <div className="au-nm" style={{ fontSize: 24 }}>
            {t('app.name')}
          </div>
          <div className="au-sub" style={{ fontSize: 11.5, marginTop: 4 }}>
            {t('app.name_latin')}
          </div>
        </div>
        <Tabs mode="register" onMode={p.onMode} top={18} />
        <div style={{ marginTop: 14 }}>
          <div className="au-lab">{t('auth.work_email')}</div>
          <label className="au-inp">
            <MailIcon />
            <input
              type="email"
              autoComplete="email"
              required
              value={v.email}
              onChange={set('email')}
              placeholder={t('auth.email.placeholder')}
            />
          </label>
        </div>
        <div style={{ marginTop: 10 }}>
          <div className="au-lab">
            {t('auth.code')}
            <em>{t('auth.code.hint')}</em>
          </div>
          <label className={`au-inp${error?.code === 'auth.code_invalid' ? ' is-error' : ''}`}>
            <ShieldCheckIcon />
            <input
              className="is-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={v.code}
              onChange={set('code')}
            />
            <button
              type="button"
              className="au-cbtn"
              disabled={!!wait || !v.email}
              onClick={sendCode}
            >
              {wait ? t('auth.code.resend_in', { s: wait }) : t('auth.code.send')}
            </button>
          </label>
        </div>
        <div className="au-grid" style={{ marginTop: 10 }}>
          <div>
            <div className="au-lab">{t('auth.nickname')}</div>
            <label className="au-inp">
              <UserIcon />
              <input required maxLength={40} value={v.displayName} onChange={set('displayName')} />
            </label>
          </div>
          <div>
            <div className="au-lab">{t('auth.set_password')}</div>
            <label className="au-inp">
              <LockIcon />
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={v.password}
                onChange={set('password')}
                placeholder={t('auth.set_password.placeholder')}
              />
            </label>
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <div className="au-lab">
            {t('auth.workspace')}
            <em>{t('auth.workspace.hint')}</em>
          </div>
          <label className="au-inp">
            <LayersIcon width={15} height={15} />
            <input
              maxLength={60}
              value={v.workspaceName}
              onChange={set('workspaceName')}
              placeholder={t('auth.workspace.placeholder')}
            />
          </label>
        </div>
        {error ? <div className="au-err">{error.message}</div> : null}
        <button type="submit" className="au-btn" style={{ marginTop: 16 }} disabled={busy}>
          {t('auth.register.submit')}
        </button>
        <div className="f12 t3" style={{ marginTop: 10, textAlign: 'center' }}>
          {t('auth.register.note')}
        </div>
      </form>
    </Shell>
  );
}
