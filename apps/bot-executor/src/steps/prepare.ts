// host_prepare (docs/06 §5.1): the flow's workspace — repos on the fix/ branch, dependencies in.
import type { StepHandler } from '../runner/loop.ts';
import { WorkspaceError, type Workspaces } from './workspace.ts';

export function prepareStep(workspaces: Workspaces): StepHandler {
  return async (step, signal) => {
    try {
      const { ws, timings } = await workspaces.ensure(step, signal);
      return { outcome: 'done', output: { branch: ws.state.branch, timings } };
    } catch (e) {
      if (e instanceof WorkspaceError) return { outcome: 'failed', output: {}, error: e.message };
      throw e;
    }
  };
}
