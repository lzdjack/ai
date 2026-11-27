// HTTP entry of cc-app (docs/06 §1.2). P1: skeleton only — request ids, the ApiError shape and a
// health check. Routes arrive with P2 (routes → service → repo, contracts in core-protocol).
import crypto from 'node:crypto';
import Fastify, { type FastifyError } from 'fastify';
import type { Db } from './db/client.ts';
import { NotFoundError, RevConflictError } from './db/write.ts';

/** Error body for every failed request (07 §2 contract rules): code is `domain.reason`. */
export interface ApiError {
  code: string;
  message: string;
  data?: unknown;
}

export function buildApp(o: { db: Db; logger?: boolean }) {
  const app = Fastify({
    logger: o.logger ?? false,
    requestIdHeader: 'x-request-id',
    genReqId: () => crypto.randomUUID(),
  });

  // one id from a click to the executor log (06 §13.5)
  app.addHook('onSend', async (req, reply) => {
    reply.header('x-request-id', req.id);
  });

  app.setErrorHandler((err: FastifyError, req, reply) => {
    const send = (status: number, body: ApiError) => reply.status(status).send(body);
    if (err instanceof NotFoundError) return send(404, { code: err.code, message: err.message });
    if (err instanceof RevConflictError)
      return send(409, { code: err.code, message: err.message, data: { rev: err.currentRev } });
    if (err.validation) return send(400, { code: 'common.invalid_request', message: err.message });
    req.log.error(err);
    return send(500, { code: 'common.internal', message: 'internal error' });
  });

  app.get('/healthz', async () => {
    await o.db.pool.query('select 1');
    return { ok: true };
  });

  return app;
}
