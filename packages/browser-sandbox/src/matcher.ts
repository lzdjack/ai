// DistAssetMatcher (docs/06 §5.2, T-06): decides, for every request the page makes, whether it is
// served from the bot's local build, fetched from the environment, or refused.
//   - entry document of the environment → fetched, then rewritten (entry.ts)
//   - asset of the target app (asset_url_patterns): exact path hit → local; hash-less stem hit → local
//     (the host page may still name app.<oldhash>.js); any other .js/.mjs/.css → refused and counted
//     as STALE_PROD_CHUNK_REQUESTED (fail closed: never run the old production code next to the new)
//   - anything else on an allowed origin (the environment, absolute asset prefixes) → fetched
//   - everything else → refused (the browser container has no network; the host is its only way out)
import fs from 'node:fs';
import path from 'node:path';

export type Decision =
  | { kind: 'entry' }
  | { kind: 'local'; file: string; key: string }
  | { kind: 'stale' }
  | { kind: 'upstream' }
  | { kind: 'denied' };

// vite: name-<8 base64url>.ext; webpack / rsbuild: name.<8-32 hex>.ext
const HASHED = /^(.+?)(?:-[A-Za-z0-9_-]{8}|\.[0-9a-f]{8,32})(\.[a-z0-9]+)$/;
const CODE = /\.(m?js|css)$/;

/** `assets/index-BKdfpp7O.js` → `assets/index.js`; null when the name carries no hash. */
export function stemOf(key: string): string | null {
  const dir = path.posix.dirname(key);
  const m = HASHED.exec(path.posix.basename(key));
  if (!m) return null;
  return `${dir === '.' ? '' : `${dir}/`}${m[1]}${m[2]}`;
}

function walk(root: string, rel = ''): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(root, r));
    else if (e.isFile()) out.push(r);
  }
  return out;
}

export interface MatcherOptions {
  /** the bot's build output */
  distDir: string;
  /** the page the repro opens, e.g. http://127.0.0.1:4201/ */
  envUrl: string;
  /** URL prefixes of the target app's assets: absolute, or a path on the environment origin */
  assetUrlPatterns: string[];
}

export class DistAssetMatcher {
  readonly exact = new Map<string, string>();
  /** stem → file; null when two files share a stem (ambiguous, so no fallback for it) */
  readonly stems = new Map<string, string | null>();
  readonly envOrigin: string;
  private readonly prefixes: string[];
  private readonly origins: Set<string>;

  constructor(private readonly o: MatcherOptions) {
    for (const key of walk(o.distDir)) {
      this.exact.set(key, path.join(o.distDir, key));
      const stem = stemOf(key);
      if (stem) this.stems.set(stem, this.stems.has(stem) ? null : path.join(o.distDir, key));
    }
    const env = new URL(o.envUrl);
    this.envOrigin = env.origin;
    this.prefixes = o.assetUrlPatterns.map((p) => new URL(p, env).href);
    this.origins = new Set([env.origin, ...this.prefixes.map((p) => new URL(p).origin)]);
  }

  /** Files of the local build's own entry (its index.html scripts), relative keys. */
  entryScripts(): string[] {
    const html = this.exact.get('index.html');
    if (!html) return [];
    const src = [...fs.readFileSync(html, 'utf8').matchAll(/<script[^>]*\bsrc="([^"]+)"/g)];
    return src
      .map((m) => this.lookup(new URL(m[1]!, 'http://x/').pathname))
      .filter((x): x is { file: string; key: string } => !!x)
      .map((x) => x.key);
  }

  /** Local file for a URL path: the longest path suffix that names a built file, then its stem. */
  lookup(pathname: string): { file: string; key: string } | null {
    const parts = decodeURIComponent(pathname).split('/').filter(Boolean);
    for (let i = 0; i < parts.length; i++) {
      const key = parts.slice(i).join('/');
      if (key.split('/').includes('..')) return null;
      const hit = this.exact.get(key);
      if (hit) return { file: hit, key };
    }
    for (let i = 0; i < parts.length; i++) {
      const stem = stemOf(parts.slice(i).join('/'));
      const hit = stem ? this.stems.get(stem) : undefined;
      if (hit)
        return { file: hit, key: path.relative(this.o.distDir, hit).split(path.sep).join('/') };
    }
    return null;
  }

  isAppAsset(url: string): boolean {
    const u = new URL(url);
    const bare = `${u.origin}${u.pathname}`;
    return this.prefixes.some((p) => bare.startsWith(p));
  }

  decide(url: string, navigation: boolean): Decision {
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      return { kind: 'denied' };
    }
    if (u.protocol === 'data:' || u.protocol === 'blob:') return { kind: 'upstream' };
    if (!this.origins.has(u.origin)) return { kind: 'denied' };
    if (navigation && u.origin === this.envOrigin) return { kind: 'entry' };
    if (this.isAppAsset(url)) {
      const hit = this.lookup(u.pathname);
      if (hit) return { kind: 'local', ...hit };
      if (CODE.test(u.pathname)) return { kind: 'stale' };
    }
    return { kind: 'upstream' };
  }
}
