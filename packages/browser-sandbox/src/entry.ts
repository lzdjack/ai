// Entry rewrite (docs/06 §5.2 item 1): the environment's HTML is parsed with parse5, tags that load
// the target app's assets are pointed at the local build, and their `integrity` is dropped (the hash
// is of the old file). Everything else, `<script nonce>` included, is kept as it was.
import { parse, serialize } from 'parse5';
import type { DistAssetMatcher } from './matcher.ts';

interface Node {
  nodeName: string;
  attrs?: { name: string; value: string }[];
  childNodes?: Node[];
  content?: Node;
}

export interface EntryRewrite {
  html: string;
  /** asset URLs that now point at the local build */
  replaced: string[];
}

export function rewriteEntry(html: string, pageUrl: string, m: DistAssetMatcher): EntryRewrite {
  const doc = parse(html) as unknown as Node;
  const replaced: string[] = [];
  const visit = (n: Node) => {
    const attr = n.nodeName === 'script' ? 'src' : n.nodeName === 'link' ? 'href' : null;
    const a = attr ? n.attrs?.find((x) => x.name === attr) : undefined;
    if (a) {
      const url = new URL(a.value, pageUrl);
      if (m.isAppAsset(url.href)) {
        const hit = m.lookup(url.pathname);
        if (hit) {
          // keep the URL's own prefix, swap the path suffix for the local file's
          const parts = url.pathname.split('/');
          const keyParts = hit.key.split('/');
          const suffix = Math.min(keyParts.length, parts.length - 1);
          url.pathname = [...parts.slice(0, parts.length - suffix), ...keyParts].join('/');
          a.value = url.href;
          replaced.push(url.href);
        }
        n.attrs = n.attrs!.filter((x) => x.name !== 'integrity');
      }
    }
    for (const c of n.childNodes ?? []) visit(c);
    if (n.content) visit(n.content);
  };
  visit(doc);
  return { html: serialize(doc as never), replaced };
}

/**
 * Runs before any page script: a lazily added script / link of the app would carry the old SRI hash
 * set from code, so integrity set through the property or setAttribute is ignored in the sandbox.
 */
export const INTEGRITY_GUARD = `(() => {
  for (const C of [HTMLScriptElement, HTMLLinkElement]) {
    Object.defineProperty(C.prototype, 'integrity', { configurable: true, get() { return ''; }, set() {} });
  }
  const set = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name, value) {
    if (String(name).toLowerCase() === 'integrity' && (this instanceof HTMLScriptElement || this instanceof HTMLLinkElement)) return;
    return set.call(this, name, value);
  };
})();`;
