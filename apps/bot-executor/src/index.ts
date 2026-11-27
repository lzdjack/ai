// Bot executor (docs/06 §5). E0-5: sandbox container runner and two-phase dependencies.
export {
  DEFAULT_LIMITS,
  ensureSandboxImage,
  runContainer,
  sandboxImageTag,
  type Mount,
  type RunOptions,
  type RunResult,
  type SandboxLimits,
} from './sandbox/docker.ts';
export {
  cloneDepsForRound,
  depsKey,
  offlineInstallScript,
  prepareDeps,
  type PreparedDeps,
} from './sandbox/deps.ts';
