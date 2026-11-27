// 接口服务与后台任务（docs/06 §1.2）。P1：平台骨架——数据库访问与 RLS 上下文、统一写入与操作记录、
// 编排推进函数、任务租约、Outbox 与外部副作用登记、HTTP 骨架。
export { buildApp, type ApiError } from './app.ts';
export { startSysLoop, type SysLoop } from './sys.ts';
export {
  ENROLL_TOKEN_MINUTES,
  issueEnrollToken,
  type RunnerSettings,
} from './service/runner-service.ts';
export {
  LeaseLostError,
  createDb,
  withLeaseTx,
  withRunnerTx,
  withWorkspaceTx,
  type ActorCtx,
  type Db,
  type Lease,
  type Tx,
} from './db/client.ts';
export { migrateDatabase } from './db/migrate.ts';
export * as schema from './db/schema/index.ts';
export { events } from './db/events.ts';
export {
  NotFoundError,
  RevConflictError,
  createWorkspace,
  findUnmatchedProbes,
  insertRow,
  recordEvent,
  restore,
  softDelete,
  updateRow,
} from './db/write.ts';
export {
  PLAN_SCHEMA_VERSION,
  advance,
  type Command,
  type Plan,
  type PlanNode,
  type Signal,
} from './orchestrator/advance.ts';
export {
  reapExpiredLeases,
  runEffect,
  type EffectIo,
  type EffectSpec,
} from './orchestrator/effects.ts';
export {
  BOT_STEP,
  RUN_NODE,
  pgOrchestrator,
  workKindFor,
  type OrchestratorPort,
} from './orchestrator/flow.ts';
export {
  claimWork,
  completeWork,
  enqueueOutbox,
  enqueueWork,
  registerEffect,
  renewLease,
} from './orchestrator/queue.ts';
