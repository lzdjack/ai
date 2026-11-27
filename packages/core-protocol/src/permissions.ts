// Permission keys, the five built-in roles and ActionGate (docs/06 §2.3, §10.1). Everything is decided
// by permission keys and their scopes; no code branches on a role name. Plugin keys are
// `ext:<plugin_id>:*` and are never granted to existing roles by default.
import { Type, type Static } from 'typebox';

/** Core permission keys used so far; later steps add keys, never rename them. */
export const CORE_PERMISSIONS = [
  'core:workspace:manage',
  'core:members:view',
  'core:members:invite',
  'core:members:manage',
  'core:roles:manage',
  'core:connectors:manage',
  'core:projects:create',
  'core:projects:manage',
  /** sees every project of the workspace without a per-project binding */
  'core:projects:view_all',
  'core:tickets:view',
  'core:tickets:create',
  'core:tickets:review',
  'core:tickets:cancel',
  'core:tickets:complete',
  'core:releases:run',
] as const;
export type CorePermission = (typeof CORE_PERMISSIONS)[number];
/** every core permission, present and future */
export const ALL_CORE = 'core:*';

export interface BuiltinRole {
  key: string;
  /** may not be preset by an invitation; the last owner cannot be removed */
  is_owner: boolean;
  permissions: string[];
}

/** Seeded into every workspace (06 §13.4 step 2); teams clone and adjust them, they stay as defaults. */
export const BUILTIN_ROLES: BuiltinRole[] = [
  { key: 'ws_owner', is_owner: true, permissions: [ALL_CORE] },
  {
    key: 'ws_admin',
    is_owner: false,
    permissions: [
      'core:workspace:manage',
      'core:members:view',
      'core:members:invite',
      'core:members:manage',
      'core:roles:manage',
      'core:connectors:manage',
      'core:projects:create',
      'core:projects:manage',
      'core:projects:view_all',
      'core:tickets:view',
      'core:tickets:create',
      'core:tickets:cancel',
      'core:releases:run',
    ],
  },
  {
    key: 'proj_lead',
    is_owner: false,
    permissions: [
      'core:members:view',
      'core:members:invite',
      'core:projects:manage',
      'core:tickets:view',
      'core:tickets:create',
      'core:tickets:review',
      'core:tickets:cancel',
      'core:tickets:complete',
      'core:releases:run',
    ],
  },
  {
    key: 'member',
    is_owner: false,
    permissions: [
      'core:members:view',
      'core:tickets:view',
      'core:tickets:create',
      'core:tickets:review',
      'core:tickets:complete',
    ],
  },
  { key: 'external_collab', is_owner: false, permissions: ['core:tickets:view'] },
];

export const GATE_REASONS = [
  'PLUGIN_NOT_INSTALLED',
  'PLUGIN_DISABLED',
  'CORE_LOCKED',
  'RBAC_DENIED',
  'USER_CREDENTIAL_MISSING',
  'USER_CREDENTIAL_EXPIRED',
] as const;

/** Embedded in responses so a client never shows a button that the server would refuse. */
export const ActionGate = Type.Object({
  visible: Type.Boolean(),
  allowed: Type.Boolean(),
  reason_code: Type.Union([
    Type.Null(),
    Type.Literal('PLUGIN_NOT_INSTALLED'),
    Type.Literal('PLUGIN_DISABLED'),
    Type.Literal('CORE_LOCKED'),
    Type.Literal('RBAC_DENIED'),
    Type.Literal('USER_CREDENTIAL_MISSING'),
    Type.Literal('USER_CREDENTIAL_EXPIRED'),
  ]),
});
export type ActionGate = Static<typeof ActionGate>;

/** True when the permission set grants `key` (core:* covers every core key). */
export function grants(perms: ReadonlySet<string>, key: string): boolean {
  return perms.has(key) || (key.startsWith('core:') && perms.has(ALL_CORE));
}
