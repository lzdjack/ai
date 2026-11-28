// /v1 routes of connectors, repositories, the probe, the trial build (docs/06 §10.3) and, from P4,
// environments and tickets (06 §2.5).
import {
  AttachReposRequest,
  CreateEnvironmentRequest,
  CreateTicketRequest,
  CreateConnectorRequest,
  UpdateRepoRequest,
  VerifyConnectorRequest,
} from '@cloudcraft/core-protocol';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { Type, type Static } from 'typebox';
import type { Db } from '../db/client.ts';
import type { AccountSettings } from '../service/account-service.ts';
import { verifyAccessToken } from '../service/auth-crypto.ts';
import { ApiFailure } from '../service/errors.ts';
import * as src from '../service/source-service.ts';
import * as tk from '../service/ticket-service.ts';

const Ws = Type.Object({ ws: Type.String({ format: 'uuid' }) });
const Item = Type.Object({
  ws: Type.String({ format: 'uuid' }),
  id: Type.String({ format: 'uuid' }),
});
const RemoteQuery = Type.Object({
  q: Type.Optional(Type.String({ maxLength: 100 })),
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  refresh: Type.Optional(Type.Integer({ minimum: 0, maximum: 1 })),
});
const PluginQuery = Type.Object({ category: Type.Optional(Type.String()) });

export function sourceRoutes(
  app: FastifyInstance,
  db: Db,
  a: AccountSettings,
  s: src.SourceSettings,
) {
  const user = (req: FastifyRequest): string => {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
    const id = m ? verifyAccessToken(a, m[1]!) : null;
    if (!id) throw new ApiFailure(401, 'auth.unauthenticated');
    return id;
  };
  const p = <T>(req: FastifyRequest) => req.params as T;

  app.get('/v1/plugins', { schema: { querystring: PluginQuery } }, async (req) => {
    user(req);
    return { items: src.listPlugins(s, (req.query as Static<typeof PluginQuery>).category) };
  });
  app.post(
    '/v1/workspaces/:ws/connectors/verify',
    { schema: { params: Ws, body: VerifyConnectorRequest } },
    async (req) =>
      src.verifyConnector(
        db,
        s,
        user(req),
        p<Static<typeof Ws>>(req).ws,
        req.body as Static<typeof VerifyConnectorRequest>,
      ),
  );
  app.post(
    '/v1/workspaces/:ws/connectors',
    { schema: { params: Ws, body: CreateConnectorRequest } },
    async (req, reply) =>
      reply
        .code(201)
        .send(
          await src.createConnector(
            db,
            s,
            user(req),
            p<Static<typeof Ws>>(req).ws,
            req.body as Static<typeof CreateConnectorRequest>,
          ),
        ),
  );
  app.get('/v1/workspaces/:ws/connectors', { schema: { params: Ws } }, async (req) => ({
    items: await src.listConnectors(db, user(req), p<Static<typeof Ws>>(req).ws),
    next_cursor: null,
    has_more: false,
  }));
  app.get(
    '/v1/workspaces/:ws/connectors/:id/remote-repos',
    { schema: { params: Item, querystring: RemoteQuery } },
    async (req) => {
      const q = req.query as Static<typeof RemoteQuery>;
      const { ws, id } = p<Static<typeof Item>>(req);
      return src.remoteRepos(db, s, user(req), ws, id, {
        search: q.q,
        page: q.page ?? 1,
        refresh: q.refresh === 1,
      });
    },
  );
  app.post(
    '/v1/workspaces/:ws/repos/batch-attach',
    { schema: { params: Ws, body: AttachReposRequest } },
    async (req, reply) =>
      reply
        .code(201)
        .send(
          await src.attachRepos(
            db,
            s,
            user(req),
            p<Static<typeof Ws>>(req).ws,
            req.body as Static<typeof AttachReposRequest>,
          ),
        ),
  );
  app.get('/v1/workspaces/:ws/repos', { schema: { params: Ws } }, async (req) =>
    src.listRepos(db, user(req), p<Static<typeof Ws>>(req).ws),
  );
  app.patch(
    '/v1/workspaces/:ws/repos/:id',
    { schema: { params: Item, body: UpdateRepoRequest } },
    async (req) => {
      const { ws, id } = p<Static<typeof Item>>(req);
      return src.updateRepo(db, s, user(req), ws, id, req.body as Static<typeof UpdateRepoRequest>);
    },
  );
  app.post('/v1/workspaces/:ws/repos/:id/probe', { schema: { params: Item } }, async (req) => {
    const { ws, id } = p<Static<typeof Item>>(req);
    return src.probe(db, s, user(req), ws, id);
  });
  app.post(
    '/v1/workspaces/:ws/projects/:id/trial-build',
    { schema: { params: Item } },
    async (req, reply) => {
      const { ws, id } = p<Static<typeof Item>>(req);
      return reply.code(202).send(await src.trialBuild(db, user(req), ws, id));
    },
  );
  app.get('/v1/workspaces/:ws/projects', { schema: { params: Ws } }, async (req) =>
    src.listProjects(db, user(req), p<Static<typeof Ws>>(req).ws),
  );
  app.get(
    '/v1/workspaces/:ws/projects/:id/environments',
    { schema: { params: Item } },
    async (req) => {
      const { ws, id } = p<Static<typeof Item>>(req);
      return tk.listEnvironments(db, user(req), ws, id);
    },
  );
  app.post(
    '/v1/workspaces/:ws/projects/:id/environments',
    { schema: { params: Item, body: CreateEnvironmentRequest } },
    async (req, reply) => {
      const { ws, id } = p<Static<typeof Item>>(req);
      return reply
        .code(201)
        .send(
          await tk.createEnvironment(
            db,
            user(req),
            ws,
            id,
            req.body as Static<typeof CreateEnvironmentRequest>,
          ),
        );
    },
  );
  app.post(
    '/v1/workspaces/:ws/projects/:id/tickets',
    { schema: { params: Item, body: CreateTicketRequest } },
    async (req, reply) => {
      const { ws, id } = p<Static<typeof Item>>(req);
      return reply
        .code(201)
        .send(
          await tk.createTicket(
            db,
            user(req),
            ws,
            id,
            req.body as Static<typeof CreateTicketRequest>,
          ),
        );
    },
  );
  app.get('/v1/workspaces/:ws/tickets', { schema: { params: Ws } }, async (req) =>
    tk.listTickets(db, user(req), p<Static<typeof Ws>>(req).ws),
  );
  app.get('/v1/workspaces/:ws/tickets/:id', { schema: { params: Item } }, async (req) => {
    const { ws, id } = p<Static<typeof Item>>(req);
    return tk.ticketDetail(db, user(req), ws, id);
  });
  app.get('/v1/workspaces/:ws/flows/:id', { schema: { params: Item } }, async (req) => {
    const { ws, id } = p<Static<typeof Item>>(req);
    return src.flowStatus(db, user(req), ws, id);
  });
}
