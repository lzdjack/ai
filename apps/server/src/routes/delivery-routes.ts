// /v1 routes of the delivery segment (docs/06 §3.3; 05 steps 5–12), personal accounts (设置 → 我的账号)
// and a project's release settings (06 §2.4 release_configs).
import {
  MergeReviewRequest,
  RetestRequest,
  RetryDeliveryRequest,
  SavePersonalAccountRequest,
  StartTestReleaseRequest,
} from '@cloudcraft/core-protocol';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { Type, type Static } from 'typebox';
import type { Db } from '../db/client.ts';
import type { AccountSettings } from '../service/account-service.ts';
import { verifyAccessToken } from '../service/auth-crypto.ts';
import * as dl from '../service/delivery-service.ts';
import { ApiFailure } from '../service/errors.ts';
import { listPersonalAccounts, savePersonalAccount } from '../service/personal-accounts.ts';
import type { SourceSettings } from '../service/source-service.ts';

const Ws = Type.Object({ ws: Type.String({ format: 'uuid' }) });
const Item = Type.Object({
  ws: Type.String({ format: 'uuid' }),
  id: Type.String({ format: 'uuid' }),
});
const ReleaseConfigRequest = Type.Object({
  repo_id: Type.String({ format: 'uuid' }),
  provider_connector_id: Type.String({ format: 'uuid' }),
  target_ref: Type.Record(Type.String(), Type.Unknown()),
  test_branch: Type.Union([Type.String({ minLength: 1, maxLength: 200 }), Type.Null()]),
});

export function deliveryRoutes(
  app: FastifyInstance,
  db: Db,
  a: AccountSettings,
  s: SourceSettings,
) {
  const user = (req: FastifyRequest): string => {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
    const id = m ? verifyAccessToken(a, m[1]!) : null;
    if (!id) throw new ApiFailure(401, 'auth.unauthenticated');
    return id;
  };
  const item = (req: FastifyRequest) => req.params as Static<typeof Item>;
  const T = '/v1/workspaces/:ws/tickets/:id/delivery';

  app.get(T, { schema: { params: Item } }, async (req) => {
    const { ws, id } = item(req);
    return dl.deliveryView(db, user(req), ws, id);
  });
  app.post(
    `${T}/test`,
    { schema: { params: Item, body: StartTestReleaseRequest } },
    async (req) => {
      const { ws, id } = item(req);
      return dl.startTestRelease(
        db,
        user(req),
        ws,
        id,
        req.body as Static<typeof StartTestReleaseRequest>,
      );
    },
  );
  app.post(
    `${T}/merge-review`,
    { schema: { params: Item, body: MergeReviewRequest } },
    async (req) => {
      const { ws, id } = item(req);
      return dl.reviewMerge(db, user(req), ws, id, req.body as Static<typeof MergeReviewRequest>);
    },
  );
  app.post(`${T}/retest`, { schema: { params: Item, body: RetestRequest } }, async (req) => {
    const { ws, id } = item(req);
    return dl.retest(db, user(req), ws, id, req.body as Static<typeof RetestRequest>);
  });
  app.post(`${T}/main`, { schema: { params: Item } }, async (req) => {
    const { ws, id } = item(req);
    return dl.requestMainMerge(db, user(req), ws, id);
  });
  app.post(`${T}/production`, { schema: { params: Item } }, async (req) => {
    const { ws, id } = item(req);
    return dl.releaseProd(db, user(req), ws, id);
  });
  app.post(`${T}/retry`, { schema: { params: Item, body: RetryDeliveryRequest } }, async (req) => {
    const { ws, id } = item(req);
    return dl.retryDelivery(db, user(req), ws, id, req.body as Static<typeof RetryDeliveryRequest>);
  });

  app.get('/v1/workspaces/:ws/me/accounts', { schema: { params: Ws } }, async (req) => ({
    items: await listPersonalAccounts(db, s, user(req), (req.params as Static<typeof Ws>).ws),
  }));
  app.put(
    '/v1/workspaces/:ws/me/accounts/:id',
    { schema: { params: Item, body: SavePersonalAccountRequest } },
    async (req) => {
      const { ws, id } = item(req);
      return savePersonalAccount(
        db,
        s,
        user(req),
        ws,
        id,
        req.body as Static<typeof SavePersonalAccountRequest>,
      );
    },
  );
  app.put(
    '/v1/workspaces/:ws/projects/:id/release-config',
    { schema: { params: Item, body: ReleaseConfigRequest } },
    async (req) => {
      const { ws, id } = item(req);
      return dl.saveReleaseConfig(
        db,
        user(req),
        ws,
        id,
        req.body as Static<typeof ReleaseConfigRequest>,
      );
    },
  );
}
