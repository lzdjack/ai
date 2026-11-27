// advance(): the pure step function of orchestration (docs/06 §3.6).
// Input: the frozen plan, the instance's node runs and one signal. Output: commands. No I/O, so it
// can be property-tested and replayed; flow.ts applies the commands inside the caller's transaction.
//
// P1 skeleton: a linear plan of auto / human nodes. Rework edges, per_repo fan-out and retry
// policies (06 §5.1, §5.1a) extend the plan schema behind plan_schema_version.

export const PLAN_SCHEMA_VERSION = 1;

export type NodeKind = 'auto' | 'human';

export interface PlanNode {
  key: string;
  kind: NodeKind;
}

export interface Plan {
  plan_schema_version: typeof PLAN_SCHEMA_VERSION;
  nodes: PlanNode[];
}

export type FlowStatus = 'running' | 'done' | 'failed' | 'cancelled';
export type NodeStatus = 'running' | 'waiting_human' | 'done' | 'failed' | 'cancelled';

export interface NodeRunView {
  id: string;
  nodeKey: string;
  attemptNo: number;
  status: string;
}

export interface FlowView {
  status: FlowStatus;
  plan: Plan;
  nodeRuns: NodeRunView[];
}

export type Signal =
  | { type: 'start' }
  /** an executor or a person finished a node */
  | { type: 'node_finished'; nodeRunId: string; outcome: 'done' | 'failed' }
  | { type: 'cancel' };

export type Command =
  | {
      type: 'open_node';
      nodeKey: string;
      nodeKind: NodeKind;
      attemptNo: number;
      status: 'running' | 'waiting_human';
    }
  /** work for the node opened by the preceding open_node with the same key and attempt */
  | { type: 'enqueue_work'; nodeKey: string; attemptNo: number }
  | { type: 'close_node'; nodeRunId: string; status: 'done' | 'failed' | 'cancelled' }
  | { type: 'finish_flow'; status: 'done' | 'failed' | 'cancelled' };

const ACTIVE = new Set(['running', 'waiting_human']);
export const isActive = (r: NodeRunView) => ACTIVE.has(r.status);

function open(node: PlanNode): Command[] {
  const cmds: Command[] = [
    {
      type: 'open_node',
      nodeKey: node.key,
      nodeKind: node.kind,
      attemptNo: 1,
      status: node.kind === 'human' ? 'waiting_human' : 'running',
    },
  ];
  // human nodes only wait for a signal; auto nodes need someone to run them
  if (node.kind === 'auto') cmds.push({ type: 'enqueue_work', nodeKey: node.key, attemptNo: 1 });
  return cmds;
}

export function advance(flow: FlowView, signal: Signal): Command[] {
  if (flow.status !== 'running') return [];
  const { nodes } = flow.plan;

  switch (signal.type) {
    case 'start': {
      if (flow.nodeRuns.length > 0 || nodes.length === 0)
        return nodes.length === 0 ? [{ type: 'finish_flow', status: 'done' }] : [];
      return open(nodes[0]!);
    }

    case 'node_finished': {
      const run = flow.nodeRuns.find((r) => r.id === signal.nodeRunId);
      // late or duplicate signals for a node that is no longer active change nothing
      if (!run || !isActive(run)) return [];
      const close: Command = { type: 'close_node', nodeRunId: run.id, status: signal.outcome };
      if (signal.outcome === 'failed') return [close, { type: 'finish_flow', status: 'failed' }];
      const next = nodes[nodes.findIndex((n) => n.key === run.nodeKey) + 1];
      return next ? [close, ...open(next)] : [close, { type: 'finish_flow', status: 'done' }];
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
