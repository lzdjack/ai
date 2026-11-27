// /v1 routes of accounts, workspaces, invitations, notifications and the WebSocket (docs/06 §2.3,
// §3.7, §10.1). Clients authenticate with `Authorization: Bearer <access token>`.
import websocket from '@fastify/websocket';
import {
  AcceptInvitationRequest,
  CreateInvitationRequest,
  CreateWorkspaceRequest,
  LoginRequest,
  OtpRequest,
  RefreshRequest,
  RegisterRequest,
  WsTicketRequest,
} from '@cloudcraft/core-protocol';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { Type, type Static } from 'typebox';
import type { Db } from '../db/client.ts';
import { startHub } from '../realtime/hub.ts';
import * as accounts from '../service/account-service.ts';
import type { AccountSettings } from '../service/account-service.ts';
import { verifyAccessToken } from '../service/auth-crypto.ts';
import { ApiFailure } from '../service/errors.ts';
import * as iam from '../service/iam-service.ts';

const WsParams = Type.Object({ ws: Type.String({ format: 'uuid' }) });
const ItemParams = Type.Object({
  ws: Type.String({ format: 'uuid' }),
  id: Type.String({ format: 'uuid' }),
});
const RevQuery = Type.Object({ rev: Type.Optional(Type.Integer()) });
const InvitationQuery = Type.Object({ invitation: Type.String({ minLength: 8, maxLength: 200 }) });
const WsQuery = Type.Object({
  ticket: Type.String(),
  since: Type.Optional(Type.Integer({ minimum: 0 })),
});

export function accountRoutes(app: FastifyInstance, db: Db, s: AccountSettings) {
  const user = (req: FastifyRequest): string => {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
    const id = m ? verifyAccessToken(s, m[1]!) : null;
    if (!id) throw new ApiFailure(401, 'auth.unauthenticated');
    return id;
  };

  app.get('/v1/bootstrap', async () => ({ register_mode: 'open', deploy_mode: 'self_hosted' }));

  app.post('/v1/auth/otp', { schema: { body: OtpRequest } }, async (req, reply) => {
    await accounts.requestOtp(db, s, req.body as Static<typeof OtpRequest>, req.ip);
    return reply.code(202).send({ ok: true });
  });
  app.post('/v1/auth/register', { schema: { body: RegisterRequest } }, async (req, reply) => {
    const r = await accounts.register(
      db,
      s,
      req.body as Static<typeof RegisterRequest>,
      req.ip,
      (uid, inv) => iam.acceptInvitation(db, s, uid, inv, req.ip),
    );
    return reply.code(201).send(r);
  });
  app.post('/v1/auth/login', { schema: { body: LoginRequest } }, async (req) =>
    accounts.login(db, s, req.body as Static<typeof LoginRequest>, req.ip),
  );
  app.post('/v1/auth/refresh', { schema: { body: RefreshRequest } }, async (req) =>
    accounts.refresh(db, s, (req.body as Static<typeof RefreshRequest>).refresh_token),
  );
  app.post('/v1/auth/logout', { schema: { body: RefreshRequest } }, async (req, reply) => {
    await accounts.logout(db, (req.body as Static<typeof RefreshRequest>).refresh_token);
    return reply.code(204).send();
  });
  app.get('/v1/me', async (req) => accounts.me(db, user(req)));

  app.post('/v1/workspaces', { schema: { body: CreateWorkspaceRequest } }, async (req, reply) =>
    reply
      .code(201)
      .send(
        await iam.createOrgWorkspace(
          db,
          user(req),
          req.body as Static<typeof CreateWorkspaceRequest>,
        ),
      ),
  );
  app.get('/v1/workspaces/:ws', { schema: { params: WsParams } }, async (req) =>
    iam.workspaceDetail(db, user(req), (req.params as Static<typeof WsParams>).ws),
  );
  app.get('/v1/workspaces/:ws/members', { schema: { params: WsParams } }, async (req) => ({
    items: await iam.listMembers(db, user(req), (req.params as Static<typeof WsParams>).ws),
    next_cursor: null,
    has_more: false,
  }));

  app.post(
    '/v1/workspaces/:ws/invitations',
    { schema: { params: WsParams, body: CreateInvitationRequest } },
    async (req, reply) =>
      reply
        .code(201)
        .send(
          await iam.createInvitation(
            db,
            s,
            user(req),
            (req.params as Static<typeof WsParams>).ws,
            req.body as Static<typeof CreateInvitationRequest>,
          ),
        ),
  );
  app.get('/v1/workspaces/:ws/invitations', { schema: { params: WsParams } }, async (req) => ({
    items: await iam.listInvitations(db, user(req), (req.params as Static<typeof WsParams>).ws),
    next_cursor: null,
    has_more: false,
  }));
  app.delete(
    '/v1/workspaces/:ws/invitations/:id',
    { schema: { params: ItemParams, querystring: RevQuery } },
    async (req, reply) => {
      const p = req.params as Static<typeof ItemParams>;
      await iam.revokeInvitation(
        db,
        user(req),
        p.ws,
        p.id,
        (req.query as Static<typeof RevQuery>).rev,
      );
      return reply.code(204).send();
    },
  );
  app.get('/v1/invitations/preview', { schema: { querystring: InvitationQuery } }, async (req) =>
    iam.previewInvitation(db, s, (req.query as Static<typeof InvitationQuery>).invitation, req.ip),
  );
  app.post(
    '/v1/invitations/accept',
    { schema: { body: AcceptInvitationRequest } },
    async (req) => ({
      workspace_id: await iam.acceptInvitation(
        db,
        s,
        user(req),
        (req.body as Static<typeof AcceptInvitationRequest>).invitation,
        req.ip,
      ),
    }),
  );

  app.get('/v1/workspaces/:ws/notifications', { schema: { params: WsParams } }, async (req) =>
    iam.listNotifications(db, user(req), (req.params as Static<typeof WsParams>).ws),
  );
  app.post(
    '/v1/workspaces/:ws/notifications/:id/read',
    { schema: { params: ItemParams } },
    async (req) => {
      const p = req.params as Static<typeof ItemParams>;
      return iam.markNotificationRead(db, user(req), p.ws, p.id);
    },
  );

  // the WebSocket and its tickets share the hub, started with the server
  app.register(async (f) => {
    const hub = await startHub(db);
    f.addHook('onClose', async () => hub.close());
    await f.register(websocket);
    f.post('/v1/ws-ticket', { schema: { body: WsTicketRequest } }, async (req) => {
      try {
        return await hub.issueTicket(
          user(req),
          (req.body as Static<typeof WsTicketRequest>).workspace_id,
        );
      } catch (e) {
        if (e instanceof ApiFailure) throw e;
        throw new ApiFailure(404, 'workspace.not_found');
      }
    });
    f.get('/v1/ws', { websocket: true, schema: { querystring: WsQuery } }, (socket, req) => {
      const q = req.query as Static<typeof WsQuery>;
      void hub.attach(socket, q.ticket, q.since ?? null).then(
        (ok) => !ok && socket.close(4001, 'invalid ticket'),
        () => socket.close(1011, 'error'),
      );
    });
  });
}
