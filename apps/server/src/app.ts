// HTTP entry of cc-app (docs/06 §1.2): request ids, the ApiError shape, a health check and the
// RunnerTransport routes (E1) and the /v1 account routes with the WebSocket (P2; routes → service →
// repo, contracts in core-protocol).
import crypto from 'node:crypto';
import Fastify, { type FastifyError } from 'fastify';
import { LeaseLostError, RunnerAuthError, type Db } from './db/client.ts';
import { NotFoundError, RevConflictError } from './db/write.ts';
import { accountRoutes } from './routes/account-routes.ts';
import { runnerRoutes } from './routes/runner-routes.ts';
import type { AccountSettings } from './service/account-service.ts';
import { ApiFailure } from './service/errors.ts';
import { hasText, tr } from './service/i18n.ts';
import { OutputTooLargeError, type RunnerSettings } from './service/runner-service.ts';

/** Error body for every failed request (07 §2 contract rules): code is `domain.reason`. */
export interface ApiError {
  code: string;
  message: string;
  data?: unknown;
}

export function buildApp(o: {
  db: Db;
  runner: RunnerSettings;
  accounts: AccountSettings;
  logger?: boolean;
}) {
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
    if (err instanceof ApiFailure) {
      if (err.retryAfter) reply.header('retry-after', String(err.retryAfter));
      const key = `error.${err.code}`;
      return send(err.status, {
        code: err.code,
        message: hasText(key) ? tr(key) : err.code,
        ...(err.data === undefined ? {} : { data: err.data }),
      });
    }
    if (err instanceof NotFoundError) return send(404, { code: err.code, message: err.message });
    if (err instanceof RevConflictError)
      return send(409, { code: err.code, message: err.message, data: { rev: err.currentRev } });
    if (err instanceof RunnerAuthError) return send(401, { code: err.code, message: err.message });
    if (err instanceof LeaseLostError)
      return send(409, { code: 'runner.lease_lost', message: err.message });
    if (err instanceof OutputTooLargeError)
      return send(413, { code: err.code, message: err.message });
    if (err.validation) return send(400, { code: 'common.invalid_request', message: err.message });
    if (err.statusCode === 413)
      return send(413, { code: 'common.payload_too_large', message: err.message });
    req.log.error(err);
    return send(500, { code: 'common.internal', message: 'internal error' });
  });

  runnerRoutes(app, o.db, o.runner);
  accountRoutes(app, o.db, o.accounts);

  app.get('/healthz', async () => {
    await o.db.pool.query('select 1');
    return { ok: true };
  });

  return app;
}
