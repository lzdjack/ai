// Contracts of accounts, workspaces, invitations, notifications and the change stream
// (docs/06 §2.3, §3.7, §10.1). Wire fields are snake_case.
import { Type, type Static } from 'typebox';
import { ActionGate } from './permissions.ts';

const Email = Type.String({ minLength: 3, maxLength: 254, pattern: '^[^@\\s]+@[^@\\s]+$' });
const Uuid = Type.String({ format: 'uuid' });

export const OtpRequest = Type.Object({
  email: Email,
  purpose: Type.Union([Type.Literal('register'), Type.Literal('password_reset')]),
});
export type OtpRequest = Static<typeof OtpRequest>;

export const RegisterRequest = Type.Object({
  email: Email,
  code: Type.String({ pattern: '^[0-9]{6}$' }),
  password: Type.String({ minLength: 8, maxLength: 200 }),
  display_name: Type.String({ minLength: 1, maxLength: 40 }),
  /** optional team name: creates a team workspace instead of the personal one (01 §9) */
  workspace_name: Type.Optional(Type.String({ maxLength: 60 })),
  /** an invitation link token or short code to join right after registering (06 §10.1) */
  invitation: Type.Optional(Type.String({ maxLength: 200 })),
});
export type RegisterRequest = Static<typeof RegisterRequest>;

export const LoginRequest = Type.Object({
  email: Email,
  password: Type.String({ minLength: 1, maxLength: 200 }),
  device_id: Type.Optional(Type.String({ maxLength: 100 })),
});
export type LoginRequest = Static<typeof LoginRequest>;

export const RefreshRequest = Type.Object({ refresh_token: Type.String({ minLength: 20 }) });

export const TokenPair = Type.Object({
  access_token: Type.String(),
  /** seconds */
  expires_in: Type.Integer(),
  refresh_token: Type.String(),
});
export type TokenPair = Static<typeof TokenPair>;

export const WorkspaceSummary = Type.Object({
  id: Uuid,
  kind: Type.Union([Type.Literal('personal'), Type.Literal('organization')]),
  name: Type.String(),
  slug: Type.String(),
  unread_notifications: Type.Integer(),
});
export type WorkspaceSummary = Static<typeof WorkspaceSummary>;

export const Me = Type.Object({
  id: Uuid,
  email: Type.String(),
  display_name: Type.String(),
  locale: Type.String(),
  workspaces: Type.Array(WorkspaceSummary),
});
export type Me = Static<typeof Me>;

export const CreateWorkspaceRequest = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 60 }),
  slug: Type.String({ pattern: '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' }),
});

export const WorkspaceDetail = Type.Object({
  id: Uuid,
  kind: Type.String(),
  name: Type.String(),
  slug: Type.String(),
  permissions: Type.Array(Type.String()),
  actions: Type.Object({
    invite_members: ActionGate,
    manage_members: ActionGate,
    manage_roles: ActionGate,
    create_project: ActionGate,
  }),
});
export type WorkspaceDetail = Static<typeof WorkspaceDetail>;

export const Member = Type.Object({
  user_id: Uuid,
  display_name: Type.String(),
  email: Type.String(),
  roles: Type.Array(Type.String()),
  joined_at: Type.String(),
});

export const CreateInvitationRequest = Type.Object({
  /** optional: bind the invitation to one address */
  email: Type.Optional(Email),
  role_key: Type.String({ minLength: 1, maxLength: 40 }),
  project_ids: Type.Optional(Type.Array(Uuid, { maxItems: 50 })),
  ttl_hours: Type.Optional(Type.Integer({ minimum: 1, maximum: 24 * 14 })),
});
export type CreateInvitationRequest = Static<typeof CreateInvitationRequest>;

export const CreatedInvitation = Type.Object({
  id: Uuid,
  /** shown once: https://<host>/join/<token> */
  token: Type.String(),
  /** shown once: #CC-XXXX-XXXX-XXXX# */
  short_code: Type.String(),
  expires_at: Type.String(),
});

export const InvitationRow = Type.Object({
  id: Uuid,
  invited_email: Type.Union([Type.String(), Type.Null()]),
  role_key: Type.String(),
  created_by: Type.String(),
  expires_at: Type.String(),
  rev: Type.Integer(),
});

export const InvitationPreview = Type.Object({
  workspace_name: Type.String(),
  workspace_kind: Type.String(),
  owner_name: Type.String(),
  inviter_name: Type.String(),
  role_key: Type.String(),
  expires_at: Type.String(),
});
export type InvitationPreview = Static<typeof InvitationPreview>;

export const AcceptInvitationRequest = Type.Object({
  invitation: Type.String({ minLength: 8, maxLength: 200 }),
});

export const Notification = Type.Object({
  id: Uuid,
  event_type: Type.String(),
  title: Type.String(),
  body: Type.String(),
  link: Type.Union([Type.String(), Type.Null()]),
  read_at: Type.Union([Type.String(), Type.Null()]),
  created_at: Type.String(),
  rev: Type.Integer(),
});
export type Notification = Static<typeof Notification>;

export const WsTicketRequest = Type.Object({ workspace_id: Uuid });
export const WsTicket = Type.Object({ ticket: Type.String(), expires_in: Type.Integer() });

/** One change pushed over the WebSocket (06 §3.7): an RLS-filtered row summary or a tombstone. */
export interface ChangeData {
  seq: number;
  entity: string;
  entity_id: string;
  op: 'upsert' | 'tombstone';
  rev: number;
  row: Record<string, unknown> | null;
}

export type WsEnvelope =
  | { v: 1; op: 'change'; ts: string; data: ChangeData }
  | { v: 1; op: 'resync_required'; ts: string; data: { from: number } }
  | { v: 1; op: 'hello'; ts: string; data: { workspace_id: string; seq: number } };
