// Contracts of tickets, rounds and the delivery card (docs/06 §2.5, §3.1, §3.2, §5.7; 05 step 3).
import { Type, type Static } from 'typebox';

export const TICKET_STATUSES = [
  'pending',
  'fixing',
  'needs_help',
  'in_review',
  'rework',
  'approved',
  'done',
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const ROUND_STATUSES = ['queued', 'fixing', 'needs_help', 'delivered', 'stopped'] as const;
export type RoundStatus = (typeof ROUND_STATUSES)[number];
export type RiskLevel = 'L0' | 'L1' | 'L2';

export const CreateTicketRequest = Type.Object({
  title: Type.String({ minLength: 1, maxLength: 120 }),
  body: Type.String({ maxLength: 20000 }),
  priority: Type.Optional(
    Type.Union([Type.Literal('P0'), Type.Literal('P1'), Type.Literal('P2'), Type.Literal('P3')]),
  ),
  repro_steps: Type.Optional(Type.Array(Type.String({ maxLength: 500 }), { maxItems: 30 })),
});
export type CreateTicketRequest = Static<typeof CreateTicketRequest>;

export const CreateEnvironmentRequest = Type.Object({
  env_code: Type.String({ pattern: '^[a-z0-9][a-z0-9-]{0,31}$' }),
  name: Type.String({ minLength: 1, maxLength: 40 }),
  env_tier: Type.Union([
    Type.Literal('dev'),
    Type.Literal('test_gate'),
    Type.Literal('production'),
  ]),
  entry_url: Type.String({ pattern: '^https?://' }),
});

/** One repo's facts of a delivery: read by the host from git and checked against the remote branch. */
export interface DeliveryRepoFacts {
  repo: string;
  branch: string;
  base_sha: string;
  head_sha: string;
  files: string[];
  added: number;
  deleted: number;
}

/** The delivery card (01 §3.4): what the model said, next to what the host established. */
export interface DeliveryCard {
  round_no: number;
  delivered_at: string;
  /** model's words */
  root_cause: string;
  summary: string;
  verification: string;
  /** host facts */
  repos: DeliveryRepoFacts[];
  checks: { key: string; ok: boolean }[];
  repro: { tests: string[]; browser: boolean };
  screenshots: { name: string; sha256: string }[];
  touched_tests: string[];
  risk_level: RiskLevel;
  risk_reasons: string[];
  delivery_digest: string;
  model: string | null;
}

export interface TicketDetail {
  id: string;
  no: string;
  title: string;
  body: string;
  priority: string;
  status: TicketStatus;
  project_id: string;
  current_round: number;
  rev: number;
  rounds: {
    round_no: number;
    status: RoundStatus;
    reason: string | null;
    flow_id: string | null;
    delivery: DeliveryCard | null;
  }[];
}
