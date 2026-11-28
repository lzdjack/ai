// DistAssetMatcher and the entry rewrite (docs/06 §5.2): what the page gets must be the bot's build or
// nothing; old production code and requests off the allowed origins never get through.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { rewriteEntry } from './entry.ts';
import { DistAssetMatcher } from './matcher.ts';

function dist(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-dist-'));
  for (const [k, v] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, k)), { recursive: true });
    fs.writeFileSync(path.join(dir, k), v);
  }
  return dir;
}

describe('DistAssetMatcher', () => {
  const dir = dist({
    'index.html': '<script type="module" crossorigin src="/assets/index-NEWh4sh1.js"></script>',
    'assets/index-NEWh4sh1.js': 'new',
    'assets/index-NEWh4sh2.css': 'new',
    'assets/vendor-AAAAAAAA.js': 'a',
    'assets/vendor-BBBBBBBB.js': 'b',
  });
  const m = new DistAssetMatcher({
    distDir: dir,
    envUrl: 'http://env.test:4201/',
    assetUrlPatterns: ['/assets/', 'https://cdn.test/app/'],
  });
  const kind = (url: string, nav = false) => m.decide(url, nav).kind;

  it('serves the local build, falls back to the hash-less stem, and fails closed on old code', () => {
    expect(kind('http://env.test:4201/', true)).toBe('entry');
    expect(m.decide('http://env.test:4201/assets/index-NEWh4sh1.js', false)).toMatchObject({
      kind: 'local',
      key: 'assets/index-NEWh4sh1.js',
    });
    // the environment still names the old hash: same stem, local file
    expect(m.decide('http://env.test:4201/assets/index-OLDh4sh1.js', false)).toMatchObject({
      kind: 'local',
      key: 'assets/index-NEWh4sh1.js',
    });
    expect(m.decide('https://cdn.test/app/assets/index-OLDh4sh9.css', false)).toMatchObject({
      kind: 'local',
      key: 'assets/index-NEWh4sh2.css',
    });
    // a chunk the new build does not have, and an ambiguous stem: never the production copy
    expect(kind('http://env.test:4201/assets/lazy-OLDh4sh3.js')).toBe('stale');
    expect(kind('http://env.test:4201/assets/vendor-CCCCCCCC.js')).toBe('stale');
    expect(kind('http://env.test:4201/assets/..%2f..%2fsecret.js')).toBe('stale');
    // images, the API: from the environment
    expect(kind('http://env.test:4201/assets/logo.png')).toBe('upstream');
    expect(kind('http://env.test:4201/api/approvals')).toBe('upstream');
    // anything off the allowed origins
    expect(kind('http://169.254.169.254/latest/meta-data/')).toBe('denied');
    expect(kind('http://127.0.0.1:4100/api/v1/me')).toBe('denied');
    expect(kind('http://env.test:9999/')).toBe('denied');
    expect(m.entryScripts()).toEqual(['assets/index-NEWh4sh1.js']);
  });

  it('points the entry tags at the local build, drops their integrity and keeps the nonce', () => {
    const html = `<!doctype html><html><head>
<script nonce="n0nce" type="module" src="/assets/index-OLDh4sh1.js" integrity="sha384-old"></script>
<link rel="stylesheet" href="/assets/index-OLDh4sh2.css" integrity="sha384-old">
<script src="https://third.party/sdk.js" integrity="sha384-keep"></script>
</head><body><div id="root"></div></body></html>`;
    const r = rewriteEntry(html, 'http://env.test:4201/', m);
    expect(r.html).toContain(
      '<script nonce="n0nce" type="module" src="http://env.test:4201/assets/index-NEWh4sh1.js">',
    );
    expect(r.html).toContain('href="http://env.test:4201/assets/index-NEWh4sh2.css"');
    expect(r.html).not.toContain('sha384-old');
    expect(r.html).toContain('sha384-keep');
    expect(r.replaced).toHaveLength(2);
  });
});
