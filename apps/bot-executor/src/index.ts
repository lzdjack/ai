// Bot executor (docs/06 §5). E0-5: sandbox container runner and two-phase dependencies.
// S1: long-running containers driven over stdio, per-round internal network + relay.
export {
  DEFAULT_LIMITS,
  ensureSandboxImage,
  runContainer,
  sandboxImageTag,
  startContainer,
  type StartedContainer,
  type Mount,
  type RunOptions,
  type RunResult,
  type SandboxLimits,
} from './sandbox/docker.ts';
export {
  cloneDepsForRound,
  depsKey,
  installRoundDeps,
  offlineInstallScript,
  prepareDeps,
  type PreparedDeps,
  type RoundDepsStep,
} from './sandbox/deps.ts';
export { RELAY_ALIAS, openRoundNetwork, type RoundNetwork } from './sandbox/relay.ts';
