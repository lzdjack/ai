// advance(): the pure step function of orchestration (docs/06 §3.6).
// Input: the frozen plan, the instance's node runs and one signal. Output: commands. No I/O, so it
// can be property-tested and replayed; flow.ts applies the commands inside the caller's transaction.
//
// Plan v1: a linear list of auto / human nodes. A node may fan out per repo (06 §5.1a: all must
// succeed by default, or allow partial continue) and may route its failure back to an earlier node
// (`on_fail`, compiled from retry_routing.on_gate_fail). People can send the flow back to any node
// (`rework`, the "all nodes" dropdown of §5.1a). Every retry appends attempt_no + 1 rows.

import type { RepoSpec } from '@cloudcraft/core-protocol';

export const PLAN_SCHEMA_VERSION = 1;

export type NodeKind = 'auto' | 'human';

export interface PlanNode {
  key: string;
  kind: NodeKind;
  /** workflow node kind (06 §2.4); decides who runs an auto node, see flow.ts workKindFor */
  node_kind?: string;
  /** node config frozen from the template version (tools, commands, gate switches) */
  config?: Record<string, unknown>;
  /** one node run per repo in `plan.repos` (06 §2.4 fanout_mode = per_repo) */
  per_repo?: boolean;
  /** how per-repo runs join; default all_must_succeed */
  join?: 'all_must_succeed' | 'allow_partial_continue';
  /** on failure go back to `rework_to` automatically while this node has fewer than `max_attempts` */
  on_fail?: { rework_to: string; max_attempts: number };
}

/** A repo of the round as frozen into the plan: where to clone it and how to build it. No secrets. */
export type { RepoSpec };

export interface Plan {
  plan_schema_version: typeof PLAN_SCHEMA_VERSION;
  nodes: PlanNode[];
  /** repos of the round, in dependency order */
  repos?: RepoSpec[];
}

export type FlowStatus = 'running' | 'done' | 'failed' | 'cancelled';
export type NodeStatus = 'running' | 'waiting_human' | 'done' | 'failed' | 'cancelled';

export interface NodeRunView {
  id: string;
  nodeKey: string;
  attemptNo: number;
  repoId: string | null;
  status: string;
  /** `interrupted` marks a run that died with an external side effect in flight */
  error?: string | null;
}

export interface FlowView {
  status: FlowStatus;
  plan: Plan;
  nodeRuns: NodeRunView[];
}

export type Signal =
  | { type: 'start' }
  /**
   * An executor or a person finished a node run. `interrupted`: the run died while an external
   * side effect was in flight (06 §3.6 item 5) — the run fails and the flow waits for a person to
   * retry or send it back, instead of routing automatically.
   */
  | { type: 'node_finished'; nodeRunId: string; outcome: 'done' | 'failed' | 'interrupted' }
  /** a person sends the flow back to any node of the plan (retrying a node is rework to itself) */
  | { type: 'rework'; toNodeKey: string }
  | { type: 'cancel' };

export type Command =
  | {
      type: 'open_node';
      nodeKey: string;
      nodeKind: NodeKind;
      attemptNo: number;
      repoId: string | null;
      status: 'running' | 'waiting_human';
    }
  /** work for the node run opened by the preceding open_node with the same key, attempt and repo */
  | { type: 'enqueue_work'; nodeKey: string; attemptNo: number; repoId: string | null }
  | {
      type: 'close_node';
      nodeRunId: string;
      status: 'done' | 'failed' | 'cancelled';
      error?: string;
    }
  | { type: 'finish_flow'; status: 'done' | 'failed' | 'cancelled' };

export const INTERRUPTED = 'interrupted';

const ACTIVE = new Set(['running', 'waiting_human']);
export const isActive = (r: { status: string }) => ACTIVE.has(r.status);

function open(plan: Plan, node: PlanNode, attemptNo: number): Command[] {
  const repos: (string | null)[] =
    node.per_repo && plan.repos?.length ? plan.repos.map((r) => r.id) : [null];
  return repos.flatMap((repoId): Command[] => [
    {
      type: 'open_node',
      nodeKey: node.key,
      nodeKind: node.kind,
      attemptNo,
      repoId,
      status: node.kind === 'human' ? 'waiting_human' : 'running',
    },
    // human nodes only wait for a signal; auto nodes need someone to run them
    ...(node.kind === 'auto'
      ? [{ type: 'enqueue_work' as const, nodeKey: node.key, attemptNo, repoId }]
      : []),
  ]);
}

const lastAttempt = (runs: NodeRunView[], key: string) =>
  Math.max(0, ...runs.filter((r) => r.nodeKey === key).map((r) => r.attemptNo));

function openNext(flow: FlowView, after: PlanNode, cmds: Command[]): Command[] {
  const { nodes } = flow.plan;
  const next = nodes[nodes.findIndex((n) => n.key === after.key) + 1];
  if (!next) return [...cmds, { type: 'finish_flow', status: 'done' }];
  return [...cmds, ...open(flow.plan, next, lastAttempt(flow.nodeRuns, next.key) + 1)];
}

function rework(flow: FlowView, to: PlanNode, cmds: Command[]): Command[] {
  const closed = new Set(cmds.flatMap((c) => (c.type === 'close_node' ? [c.nodeRunId] : [])));
  const cancel = flow.nodeRuns
    .filter((r) => isActive(r) && !closed.has(r.id))
    .map((r): Command => ({ type: 'close_node', nodeRunId: r.id, status: 'cancelled' }));
  return [...cmds, ...cancel, ...open(flow.plan, to, lastAttempt(flow.nodeRuns, to.key) + 1)];
}

function nodeFinished(flow: FlowView, s: Extract<Signal, { type: 'node_finished' }>): Command[] {
  const run = flow.nodeRuns.find((r) => r.id === s.nodeRunId);
  // late or duplicate signals for a run that is no longer active change nothing
  if (!run || !isActive(run)) return [];
  const node = flow.plan.nodes.find((n) => n.key === run.nodeKey)!;
  const close: Extract<Command, { type: 'close_node' }> =
    s.outcome === 'interrupted'
      ? { type: 'close_node', nodeRunId: run.id, status: 'failed', error: INTERRUPTED }
      : { type: 'close_node', nodeRunId: run.id, status: s.outcome };
  const cmds: Command[] = [close];

  // the join: all runs of this node attempt (one per repo, or just this one)
  const siblings = flow.nodeRuns
    .filter((r) => r.nodeKey === run.nodeKey && r.attemptNo === run.attemptNo)
    .map((r) => (r.id === run.id ? { ...r, status: close.status, error: close.error } : r));
  if (siblings.some(isActive)) return cmds;
  // a person decides what happens after an interruption, even if the other repos succeeded
  if (siblings.some((r) => r.error === INTERRUPTED)) return cmds;

  const ok = siblings.filter((r) => r.status === 'done').length;
  const succeeded = ok === siblings.length || (node.join === 'allow_partial_continue' && ok > 0);
  if (succeeded) return openNext(flow, node, cmds);

  const back = node.on_fail && flow.plan.nodes.find((n) => n.key === node.on_fail!.rework_to);
  if (back && run.attemptNo < node.on_fail!.max_attempts) return rework(flow, back, cmds);
  return [...cmds, { type: 'finish_flow', status: 'failed' }];
}

export function advance(flow: FlowView, signal: Signal): Command[] {
  if (flow.status !== 'running') return [];
  const { nodes } = flow.plan;

  switch (signal.type) {
    case 'start': {
      if (flow.nodeRuns.length > 0) return [];
      return nodes.length === 0
        ? [{ type: 'finish_flow', status: 'done' }]
        : open(flow.plan, nodes[0]!, 1);
    }

    case 'node_finished':
      return nodeFinished(flow, signal);

    case 'rework': {
      const to = nodes.find((n) => n.key === signal.toNodeKey);
      // before start there is nothing to send back; unknown nodes are rejected by the caller
      if (!to || flow.nodeRuns.length === 0) return [];
      return rework(flow, to, []);
    }

    case 'cancel':
      return [
        ...flow.nodeRuns
          .filter(isActive)
          .map((r): Command => ({ type: 'close_node', nodeRunId: r.id, status: 'cancelled' })),
        { type: 'finish_flow', status: 'cancelled' },
      ];
  }
}
