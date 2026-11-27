// Declarative browser repro (docs/06 §5.7 item 1, §5.2): a JSON script the bot hands in and the host
// interprets in the browser sandbox, against the test environment with the bot's build swapped in.
// It must fail on the base build and pass on the fix. Only the assert steps decide the verdict; a
// script that breaks on a click or a missing element proves nothing.
import { Type, type Static } from 'typebox';

const Text = Type.String({ minLength: 1, maxLength: 300 });

/** How a step finds an element; exactly one of role / text / label / css, optionally the n-th match. */
export const BrowserLocator = Type.Object(
  {
    role: Type.Optional(
      Type.String({
        maxLength: 40,
        description: 'ARIA role, e.g. button, link, row, cell, combobox',
      }),
    ),
    name: Type.Optional(Type.String({ maxLength: 300, description: 'accessible name, with role' })),
    text: Type.Optional(Type.String({ maxLength: 300, description: 'visible text (substring)' })),
    label: Type.Optional(Type.String({ maxLength: 300, description: 'form field label' })),
    css: Type.Optional(Type.String({ maxLength: 300, description: 'CSS selector' })),
    nth: Type.Optional(
      Type.Integer({ minimum: 0, maximum: 1000, description: '0-based match index' }),
    ),
  },
  { additionalProperties: false },
);
export type BrowserLocator = Static<typeof BrowserLocator>;

/** One selector kind per locator (the schema cannot say "exactly one of"); null when fine. */
export function locatorError(l: BrowserLocator): string | null {
  const kinds = (['role', 'text', 'label', 'css'] as const).filter((k) => l[k] !== undefined);
  if (kinds.length !== 1) return 'a locator needs exactly one of role, text, label, css';
  if (l.name !== undefined && !l.role) return 'name only goes with role';
  return null;
}

export const BrowserStep = Type.Union([
  Type.Object(
    {
      goto: Type.String({
        maxLength: 500,
        description: 'path on the test environment, e.g. /#/list',
      }),
    },
    { additionalProperties: false },
  ),
  Type.Object({ click: BrowserLocator }, { additionalProperties: false }),
  Type.Object(
    { fill: BrowserLocator, value: Type.String({ maxLength: 2000 }) },
    { additionalProperties: false },
  ),
  Type.Object(
    { select: BrowserLocator, value: Type.String({ maxLength: 300 }) },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      /** assert: the element (or the whole page) contains / does not contain / equals the text */
      expect_text: Text,
      in: Type.Optional(BrowserLocator),
      mode: Type.Optional(
        Type.Union([
          Type.Literal('contains'),
          Type.Literal('not_contains'),
          Type.Literal('equals'),
        ]),
      ),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    { screenshot: Type.String({ pattern: '^[a-z0-9-]{1,40}$', description: 'name of the shot' }) },
    { additionalProperties: false },
  ),
]);
export type BrowserStep = Static<typeof BrowserStep>;

export const BrowserRepro = Type.Object(
  {
    /** the repository whose build is swapped into the page */
    repo: Type.String({ minLength: 1, maxLength: 100 }),
    steps: Type.Array(BrowserStep, { minItems: 2, maxItems: 40 }),
  },
  { additionalProperties: false },
);
export type BrowserRepro = Static<typeof BrowserRepro>;

/**
 * Models that fill every optional field send "" for the selector kinds they do not use; those mean
 * "not given". Returns a copy without them.
 */
export function normalizeBrowserRepro(r: BrowserRepro): BrowserRepro {
  const clean = (l: BrowserLocator) =>
    Object.fromEntries(Object.entries(l).filter(([, v]) => v !== '')) as BrowserLocator;
  return {
    ...r,
    steps: r.steps.map((s) => {
      const x = { ...(s as Record<string, unknown>) };
      for (const k of ['click', 'fill', 'select', 'in'])
        if (x[k] && typeof x[k] === 'object') x[k] = clean(x[k] as BrowserLocator);
      return x as BrowserStep;
    }),
  };
}

/** Locator problems of a whole script, as `step N: …`. */
export function browserReproErrors(r: BrowserRepro): string[] {
  return r.steps.flatMap((s, i) => {
    const x = s as Record<string, unknown>;
    const loc = (x.click ?? x.fill ?? x.select ?? x.in) as BrowserLocator | undefined;
    const e = loc ? locatorError(loc) : null;
    return e ? [`step ${i}: ${e}`] : [];
  });
}

/** Invariants of a dist-replacement run (06 §5.7, browser_dist_replace Hard Gate). */
export interface DistReplaceInvariants {
  entry_js_replaced: boolean;
  stale_prod_chunk_blocked: number;
  dist_asset_hits: number;
  page_crash: boolean;
}

export const invariantsHold = (i: DistReplaceInvariants) =>
  i.entry_js_replaced && i.stale_prod_chunk_blocked === 0 && i.dist_asset_hits > 0 && !i.page_crash;
