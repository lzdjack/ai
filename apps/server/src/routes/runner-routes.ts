// RunnerTransport over HTTP (docs/06 §5.3a): POST + JSON, frames capped at 64 KB. Authorization is
// `Runner <runner_id>:<secret>` on every call except enrollment, which carries its one-time token.
import {
  ARTIFACT_LIMIT,
  CheckAncestryRequest,
  FetchArtifactRequest,
  HeldLease,
  UploadArtifactRequest,
  CompleteStepRequest,
  CompleteStepResponse,
  CredentialEnvelope,
  EVIDENCE_LIMIT,
  FetchCredentialRequest,
  HeartbeatRequest,
  HeartbeatResponse,
  RUNNER_FRAME_LIMIT,
  RUNNER_PATHS,
  RegisterRunnerRequest,
  RegisterRunnerResponse,
  UploadEvidenceRequest,
} from '@cloudcraft/core-protocol';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { RunnerAuthError, type Db } from '../db/client.ts';
import {
  completeRoundStep,
  heartbeatAndPoll,
  registerRunner,
  type RunnerSettings,
  fetchCredential,
} from '../service/runner-service.ts';
import { uploadEvidence } from '../service/evidence-service.ts';
import {
  checkAncestry,
  fetchArtifact,
  fetchStepSecrets,
  uploadArtifact,
} from '../service/release-step-service.ts';
import type { SourceSettings } from '../service/source-service.ts';

const AUTH = /^Runner ([0-9a-f-]{36}):(\S+)$/;

function runnerAuth(req: FastifyRequest) {
  const m = AUTH.exec(req.headers.authorization ?? '');
  if (!m) throw new RunnerAuthError();
  return { runnerId: m[1]!, secret: m[2]! };
}

export function runnerRoutes(
  app: FastifyInstance,
  db: Db,
  s: RunnerSettings,
  sources: SourceSettings,
  evidenceDir: string,
  artifactDir: string,
) {
  const opts = { bodyLimit: RUNNER_FRAME_LIMIT };
  app.post<{ Body: RegisterRunnerRequest }>(
    RUNNER_PATHS.registerRunner,
    { ...opts, schema: { body: RegisterRunnerRequest, response: { 200: RegisterRunnerResponse } } },
    (req) => registerRunner(db, s, req.body),
  );
  app.post<{ Body: HeartbeatRequest }>(
    RUNNER_PATHS.heartbeatAndPoll,
    { ...opts, schema: { body: HeartbeatRequest, response: { 200: HeartbeatResponse } } },
    (req) => heartbeatAndPoll(db, s, runnerAuth(req), req.body),
  );
  app.post<{ Body: CompleteStepRequest }>(
    RUNNER_PATHS.completeRoundStep,
    { ...opts, schema: { body: CompleteStepRequest, response: { 200: CompleteStepResponse } } },
    async (req) => {
      const next = await completeRoundStep(db, s, runnerAuth(req), req.body);
      return { accepted: true, ...(next ? { next } : {}) };
    },
  );
  app.post<{ Body: FetchCredentialRequest }>(
    RUNNER_PATHS.fetchCredential,
    { ...opts, schema: { body: FetchCredentialRequest, response: { 200: CredentialEnvelope } } },
    (req) => fetchCredential(db, sources, runnerAuth(req), req.body),
  );
  // screenshots are bigger than a control frame: one file per call, base64 in JSON
  app.post<{ Body: UploadEvidenceRequest }>(
    RUNNER_PATHS.uploadEvidence,
    {
      bodyLimit: Math.ceil((EVIDENCE_LIMIT * 4) / 3) + RUNNER_FRAME_LIMIT,
      schema: { body: UploadEvidenceRequest },
    },
    (req) => uploadEvidence(db, evidenceDir, runnerAuth(req), req.body),
  );
  // delivery steps (06 §7.1): craft build output in, artifact files out, the release step's accounts
  app.post<{ Body: UploadArtifactRequest }>(
    RUNNER_PATHS.uploadArtifact,
    {
      bodyLimit: Math.ceil((ARTIFACT_LIMIT * 4) / 3) + RUNNER_FRAME_LIMIT,
      schema: { body: UploadArtifactRequest },
    },
    (req) => uploadArtifact(db, sources, artifactDir, runnerAuth(req), req.body),
  );
  app.post<{ Body: FetchArtifactRequest }>(
    RUNNER_PATHS.fetchArtifact,
    { ...opts, schema: { body: FetchArtifactRequest } },
    (req) => fetchArtifact(db, artifactDir, runnerAuth(req), req.body),
  );
  app.post<{ Body: HeldLease }>(
    RUNNER_PATHS.fetchStepSecrets,
    { ...opts, schema: { body: HeldLease, response: { 200: CredentialEnvelope } } },
    (req) => fetchStepSecrets(db, sources, runnerAuth(req), req.body),
  );
  app.post<{ Body: CheckAncestryRequest }>(
    RUNNER_PATHS.checkAncestry,
    { ...opts, schema: { body: CheckAncestryRequest } },
    (req) => checkAncestry(db, sources, runnerAuth(req), req.body),
  );
}
