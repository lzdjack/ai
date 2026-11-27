// Repository probe (docs/06 §10.3 item 3; 01 §11 "AI 猜不出来的才让人做"): reads a few files through
// the connector (no clone) and guesses the toolchain. Deterministic rules first; every guess carries a
// note so the "fine-tune" drawer can show why. Fields a person overrode are never touched here.
import type { RepoSettings } from '@cloudcraft/core-protocol';

export type ReadFile = (path: string) => Promise<string | null>;

export interface ProbeResult {
  settings: RepoSettings;
  notes: string[];
}

interface Pkg {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  packageManager?: string;
}

const UI_LIBS = ['react', 'vue', 'svelte', 'solid-js', '@angular/core', 'preact'];
const BUNDLERS: Record<string, { dist: string; assets: string[] }> = {
  vite: { dist: 'dist', assets: ['/assets/'] },
  '@rsbuild/core': { dist: 'dist', assets: ['/static/'] },
  webpack: { dist: 'dist', assets: ['/static/', '/js/', '/css/'] },
};

export async function probeRepo(read: ReadFile, defaultBranch: string): Promise<ProbeResult> {
  const notes: string[] = [];
  const raw = await read('package.json');
  if (!raw) {
    notes.push('no package.json: not a Node project, only the test suite strategy applies');
    return {
      settings: {
        default_branch: defaultBranch,
        package_manager: null,
        build_command: null,
        test_command: null,
        typecheck_command: null,
        dist_dir: null,
        verify_strategy: 'test_suite',
        asset_url_patterns: [],
      },
      notes,
    };
  }
  const pkg = JSON.parse(raw) as Pkg;
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const scripts = pkg.scripts ?? {};

  // 1. package manager: packageManager field, then the lockfile
  let pm: RepoSettings['package_manager'] = null;
  const declared = /^(pnpm|npm|yarn)@/.exec(
    pkg.packageManager ?? '',
  )?.[1] as RepoSettings['package_manager'];
  if (declared) {
    pm = declared;
    notes.push(`package manager ${pm} from packageManager`);
  } else
    for (const [file, name] of [
      ['pnpm-lock.yaml', 'pnpm'],
      ['yarn.lock', 'yarn'],
      ['package-lock.json', 'npm'],
    ] as const)
      if ((await read(file)) !== null) {
        pm = name;
        notes.push(`package manager ${pm} from ${file}`);
        break;
      }
  pm ??= 'npm';
  const run = (script: string) => (pm === 'npm' ? `npm run ${script}` : `${pm} ${script}`);
  const exec = (bin: string) => (pm === 'npm' ? `npx ${bin}` : `${pm} exec ${bin}`);

  // 2. build / test / typecheck from scripts
  const build = scripts.build ? run('build') : null;
  if (build) notes.push(`build: scripts.build (${scripts.build})`);
  else notes.push('no build script');
  // the replay appends test files, so prefer calling the runner directly
  let test: string | null = null;
  if (deps.vitest) test = exec('vitest run');
  else if (deps.jest) test = exec('jest');
  else if (scripts.test) test = pm === 'npm' ? 'npm test --' : run('test');
  if (test) notes.push(`tests: ${test}`);
  let typecheck: string | null = null;
  if (scripts.typecheck) typecheck = run('typecheck');
  else if (deps.typescript && (await read('tsconfig.json')) !== null)
    typecheck = exec('tsc -p . --noEmit');
  if (typecheck) notes.push(`typecheck: ${typecheck}`);

  // 3. what the build produces, and whether a browser can check it
  const bundler = Object.keys(BUNDLERS).find((b) => deps[b]);
  const ui = UI_LIBS.some((l) => deps[l]);
  const page = (await read('index.html')) !== null || (await read('public/index.html')) !== null;
  let dist: string | null = null;
  let assets: string[] = [];
  if (bundler) {
    dist = BUNDLERS[bundler]!.dist;
    assets = BUNDLERS[bundler]!.assets;
    const cfg =
      bundler === 'vite'
        ? ((await read('vite.config.ts')) ?? (await read('vite.config.js')))
        : null;
    const outDir = cfg && /outDir\s*:\s*['"]([^'"]+)['"]/.exec(cfg)?.[1];
    const base = cfg && /\bbase\s*:\s*['"]([^'"]+)['"]/.exec(cfg)?.[1];
    if (outDir) dist = outDir;
    if (base && base !== '/') assets = assets.map((a) => `${base.replace(/\/$/, '')}${a}`);
    notes.push(`build output ${dist}/ (${bundler}), app assets under ${assets.join(', ')}`);
  }
  const browser = !!(bundler && ui && page && build);
  notes.push(
    browser
      ? 'web app with an entry page: fixes are also checked in a browser with the build swapped in'
      : 'checked by its test suite',
  );
  return {
    settings: {
      default_branch: defaultBranch,
      package_manager: pm,
      build_command: build,
      test_command: test,
      typecheck_command: typecheck,
      dist_dir: dist,
      verify_strategy: browser ? 'browser_dist_replace' : 'test_suite',
      asset_url_patterns: browser ? assets : [],
    },
    notes,
  };
}
