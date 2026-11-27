// Bot executor (docs/06 §5). E0-5: sandbox container runner and two-phase dependencies.
// S1: long-running containers driven over stdio, per-round internal network + relay.
// E1: RunnerTransport client, enrollment, the heartbeat / step loop and the trial build step.
export {
  DEFAULT_LIMITS,
  ensureSandboxImage,
  killLabeled,
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
export {
  RunnerApiError,
  httpTransport,
  type RunnerCredentials,
  type RunnerTransport,
} from './runner/transport.ts';
export { loadOrEnroll } from './runner/identity.ts';
export {
  startRunnerLoop,
  type RunnerLoop,
  type StepHandler,
  type StepResult,
} from './runner/loop.ts';
export { trialBuild, type TrialBuildOptions } from './steps/trial-build.ts';
