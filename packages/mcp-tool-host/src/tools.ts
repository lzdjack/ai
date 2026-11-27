// Host tools an engine may expose to its model (docs/06 §5.4, §5.7). Each call is checked again here,
// whatever the engine already checked: the round token, whether the node allows the tool, the
// parameters, and facts the model claims (files must really exist). Facts such as changed files and
// commit SHAs are never taken from the model; the executor reads them from git afterwards.
// ask_user, submit_diagnosis, report_progress and ack_supplement come with P4 (their cards and pages).
import fs from 'node:fs';
import path from 'node:path';
import {
  BrowserRepro,
  browserReproErrors,
  normalizeBrowserRepro,
  type HostToolDecl,
} from '@cloudcraft/core-protocol';
import { Type, type Static } from 'typebox';

export const SUBMIT_DELIVERY = 'submit_delivery';

export const SubmitDeliveryParams = Type.Object({
  root_cause: Type.String({
    minLength: 1,
    maxLength: 2000,
    description: 'Where the bug comes from: file, function and what was wrong.',
  }),
  summary: Type.String({
    minLength: 1,
    maxLength: 3000,
    description: 'What you changed and why it fixes the bug.',
  }),
  repro_tests: Type.Optional(
    Type.Array(Type.String({ minLength: 1, maxLength: 300 }), {
      maxItems: 10,
      description:
        'Test files you wrote that reproduce the bug: they fail before your fix and pass after it. ' +
        'Paths relative to /work, starting with the repository directory, e.g. demo-web/src/x/y.test.ts.',
    }),
  ),
  browser_repro: Type.Optional(
    Type.Object(BrowserRepro.properties, {
      additionalProperties: false,
      description:
        'Only for a repository marked browser-verified. Steps the host runs in a real browser on the ' +
        'deployed test environment with your build of that repository swapped in. It must stop on an ' +
        'expect_text step before your fix and pass after it. Each locator uses exactly one of role ' +
        '(with optional name), text, label or css, plus an optional 0-based nth. goto takes a path ' +
        'on the environment, e.g. /#/approvals. Base texts and locators on the source code.',
    }),
  ),
  verification: Type.String({
    minLength: 1,
    maxLength: 3000,
    description: 'Commands you ran to verify (tests, typecheck) and their results.',
  }),
});
export type SubmitDelivery = Static<typeof SubmitDeliveryParams>;

/** What a tool sees of the round. */
export interface ToolRound {
  /** host directory mounted at /work */
  workDir: string;
  /** repository directories under /work */
  repos: string[];
  /** repositories whose fix is also replayed in a browser (verify_strategy browser_dist_replace) */
  browserRepos?: string[];
}

export type ToolResult = { ok: true; text: string; record?: unknown } | { ok: false; text: string };

export interface HostTool {
  decl: HostToolDecl;
  /** called once per round at most when true; later calls are refused */
  once: boolean;
  /** params already passed the schema */
  handle(params: never, round: ToolRound): ToolResult;
}

/** A path the model gave, relative to /work; null unless it names a file inside one of the repos. */
export function workFile(round: ToolRound, p: string): string | null {
  const rel = path.posix.normalize(p.replace(/^\/work\//, ''));
  const [repo] = rel.split('/');
  if (rel.startsWith('..') || path.posix.isAbsolute(rel) || !repo || !round.repos.includes(repo))
    return null;
  const abs = path.join(round.workDir, rel);
  try {
    // no symlinks out of the work dir
    const real = fs.realpathSync(abs);
    if (!real.startsWith(fs.realpathSync(round.workDir) + path.sep)) return null;
    return fs.statSync(real).isFile() ? rel : null;
  } catch {
    return null;
  }
}

const submitDelivery: HostTool = {
  decl: {
    name: SUBMIT_DELIVERY,
    label: 'Submit delivery',
    description:
      'Call exactly once when the fix is done and verified. The host commits your changes, ' +
      'replays your repro (tests and/or browser steps) before and after the fix, and reports the verdict.',
    parameters: SubmitDeliveryParams,
  },
  once: true,
  handle(params: SubmitDelivery, round) {
    const b = params.browser_repro && normalizeBrowserRepro(params.browser_repro);
    const tests = params.repro_tests ?? [];
    if (!tests.length && !b) return { ok: false, text: 'give repro_tests, browser_repro, or both' };
    if (b && !round.browserRepos?.includes(b.repo))
      return {
        ok: false,
        text: `${b.repo} is not browser-verified; browser_repro works for: ${round.browserRepos?.join(', ') || 'none'}`,
      };
    const bad = b ? browserReproErrors(b) : [];
    if (bad.length) return { ok: false, text: `browser_repro: ${bad.join('; ')}` };
    const files = tests.map((p) => [p, workFile(round, p)] as const);
    const absent = files.filter(([, f]) => !f).map(([p]) => p);
    if (absent.length)
      return {
        ok: false,
        text: `repro test files not found in the repositories under /work: ${absent.join(', ')}`,
      };
    return {
      ok: true,
      text: 'Delivery received. The host will commit your changes and replay the repro tests. You are done; stop here.',
      record: {
        ...params,
        repro_tests: files.map(([, f]) => f!),
        ...(b ? { browser_repro: b } : {}),
      },
    };
  },
};

/** Every host tool by name; a node's allowed_tools picks from these. */
export const HOST_TOOLS: Record<string, HostTool> = {
  [SUBMIT_DELIVERY]: submitDelivery as HostTool,
};

/** Tools that end an AI node; without a call to one of them the run did not finish. */
export const FINISHING_TOOLS = [SUBMIT_DELIVERY];
