// Evidence files (docs/06 §2.5 evidences, §6.2): the executor uploads each replay screenshot while it
// holds the step's lease; people of the workspace read them through the ticket. M1 keeps the files on
// the server's disk, one directory per workspace, named by their sha256 (object storage in Q1).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { EVIDENCE_LIMIT, type UploadEvidenceRequest } from '@cloudcraft/core-protocol';
import { and, eq, isNull } from 'drizzle-orm';
import { LeaseLostError, withRunnerTx, type Db } from '../db/client.ts';
import { evidences, rounds } from '../db/schema/index.ts';
import { insertRow } from '../db/write.ts';
import { getNodeRunWithFlow, lockHeldLease } from '../repo/runner-repo.ts';
import { ApiFailure } from './errors.ts';
import { inWorkspace } from './iam-service.ts';

const fileOf = (dir: string, ws: string, sha256: string) => path.join(dir, ws, `${sha256}.png`);

export function uploadEvidence(
  db: Db,
  dir: string,
  auth: { runnerId: string; secret: string },
  req: UploadEvidenceRequest,
): Promise<{ id: string }> {
  const data = Buffer.from(req.data_base64, 'base64');
  if (data.length > EVIDENCE_LIMIT) throw new ApiFailure(413, 'runner.evidence_too_large');
  if (crypto.createHash('sha256').update(data).digest('hex') !== req.sha256)
    throw new ApiFailure(400, 'runner.evidence_sha_mismatch');
  return withRunnerTx(db, auth, async (tx, ctx) => {
    const item = await lockHeldLease(tx, auth.runnerId, req);
    if (!item) throw new LeaseLostError();
    const { run, flow } = await getNodeRunWithFlow(
      tx,
      (item.payload as { node_run_id: string }).node_run_id,
    );
    const [existing] = await tx
      .select({ id: evidences.id })
      .from(evidences)
      .where(and(eq(evidences.nodeRunId, run.id), eq(evidences.name, req.name)));
    if (existing) return existing;
    // the file first (local disk, not a network call); a row never points at a missing file
    const file = fileOf(dir, ctx.workspaceId, req.sha256);
    if (!fs.existsSync(file)) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = `${file}.${crypto.randomUUID()}.tmp`;
      fs.writeFileSync(tmp, data);
      fs.renameSync(tmp, file);
    }
    const [round] = await tx
      .select({ id: rounds.id })
      .from(rounds)
      .where(eq(rounds.flowInstanceId, flow.id));
    const row = await insertRow(tx, ctx, evidences, {
      projectId: flow.projectId!,
      roundId: round?.id ?? null,
      nodeRunId: run.id,
      name: req.name,
      sha256: req.sha256,
      contentType: req.content_type,
      sizeBytes: data.length,
    });
    return { id: row.id };
  });
}

/** The file of an evidence the user can see (RLS decides), or 404. */
export function evidenceFile(db: Db, dir: string, userId: string, ws: string, id: string) {
  return inWorkspace(db, userId, ws, async (tx) => {
    const [e] = await tx
      .select()
      .from(evidences)
      .where(and(eq(evidences.id, id), isNull(evidences.deletedAt)));
    if (!e || e.storageState !== 'active') throw new ApiFailure(404, 'evidence.not_found');
    const file = fileOf(dir, ws, e.sha256);
    if (!fs.existsSync(file)) throw new ApiFailure(404, 'evidence.not_found');
    return { file, contentType: e.contentType, sha256: e.sha256 };
  });
}
