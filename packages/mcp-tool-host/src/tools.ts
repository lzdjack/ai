// Host tools an engine may expose to its model (docs/06 §5.4, §5.7). Each call is checked again here,
// whatever the engine already checked: the round token, whether the node allows the tool, the
// parameters, and facts the model claims (files must really exist). Facts such as changed files and
// commit SHAs are never taken from the model; the executor reads them from git afterwards.
// ask_user, submit_diagnosis, report_progress and ack_supplement come with P4 (their cards and pages).
import fs from 'node:fs';
import path from 'node:path';
import type { HostToolDecl } from '@cloudcraft/core-protocol';
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
  repro_tests: Type.Array(Type.String({ minLength: 1, maxLength: 300 }), {
    minItems: 1,
    maxItems: 10,
    description:
      'Test files you wrote that reproduce the bug: they fail before your fix and pass after it. ' +
      'Paths relative to /work, starting with the repository directory, e.g. demo-web/src/x/y.test.ts.',
  }),
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
      'replays your repro tests before and after the fix, and reports the verdict.',
    parameters: SubmitDeliveryParams,
  },
  once: true,
  handle(params: SubmitDelivery, round) {
    const files = params.repro_tests.map((p) => [p, workFile(round, p)] as const);
    const absent = files.filter(([, f]) => !f).map(([p]) => p);
    if (absent.length)
      return {
        ok: false,
        text: `repro test files not found in the repositories under /work: ${absent.join(', ')}`,
      };
    return {
      ok: true,
      text: 'Delivery received. The host will commit your changes and replay the repro tests. You are done; stop here.',
      record: { ...params, repro_tests: files.map(([, f]) => f!) },
    };
  },
};

/** Every host tool by name; a node's allowed_tools picks from these. */
export const HOST_TOOLS: Record<string, HostTool> = {
  [SUBMIT_DELIVERY]: submitDelivery as HostTool,
};

/** Tools that end an AI node; without a call to one of them the run did not finish. */
export const FINISHING_TOOLS = [SUBMIT_DELIVERY];
