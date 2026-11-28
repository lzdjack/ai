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

/** Quick reasons of the send-back dialog (01 PC-打回原因); stored as reviews.reject_category. */
export const REJECT_CATEGORIES = [
  'still_broken',
  'regression',
  'insufficient_verification',
  'approach_rejected',
] as const;
export type RejectCategory = (typeof REJECT_CATEGORIES)[number];

/**
 * Approve or send back the current round (06 §3.1 "待我审核 → 审核通过 / 打回重修"). The round and
 * its delivery_digest + review_rev must be the latest, otherwise 409 (the bot delivered again).
 */
export const ReviewRequest = Type.Object({
  decision: Type.Union([Type.Literal('approve'), Type.Literal('reject')]),
  round_no: Type.Integer({ minimum: 1 }),
  delivery_digest: Type.String({ minLength: 1, maxLength: 128 }),
  review_rev: Type.Integer({ minimum: 0 }),
  /** required to send back: handed to the bot as is */
  comment: Type.Optional(Type.String({ maxLength: 5000 })),
  reject_category: Type.Optional(
    Type.Union([
      Type.Literal('still_broken'),
      Type.Literal('regression'),
      Type.Literal('insufficient_verification'),
      Type.Literal('approach_rejected'),
    ]),
  ),
  /** code position the comment is about */
  location: Type.Optional(
    Type.Object({
      repo: Type.String({ maxLength: 200 }),
      path: Type.String({ maxLength: 500 }),
      line: Type.Optional(Type.Integer({ minimum: 1 })),
      text: Type.Optional(Type.String({ maxLength: 500 })),
    }),
  ),
});
export type ReviewRequest = Static<typeof ReviewRequest>;

/**
 * Project risk rules (06 §5.7 item 2, `projects.risk_rules`); anything left out keeps the default of
 * 06 §13.6: L0 up to 30 lines / 3 files, L1 up to 300 / 15, high-risk path segments below.
 */
export interface RiskRules {
  l0_max_lines?: number;
  l0_max_files?: number;
  l1_max_lines?: number;
  l1_max_files?: number;
  /** path segments (directory or file name) that make a change L2 */
  high_risk_paths?: string[];
}
export const DEFAULT_RISK_RULES: Required<RiskRules> = {
  l0_max_lines: 30,
  l0_max_files: 3,
  l1_max_lines: 300,
  l1_max_files: 15,
  high_risk_paths: ['auth', 'rbac', 'pay', 'salary', 'migration', 'migrations', 'Dockerfile'],
};

/** One repo's facts of a delivery: read by the host from git and checked against the remote branch. */
export interface EnvironmentRow {
  id: string;
  env_code: string;
  env_tier: string;
  name: string;
  entry_url: string;
}

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
  /** evidence_id: the file uploaded by the executor (GET …/evidence/:id), null when it is missing */
  screenshots: { name: string; sha256: string; evidence_id?: string | null }[];
  touched_tests: string[];
  risk_level: RiskLevel;
  risk_reasons: string[];
  delivery_digest: string;
  model: string | null;
}

/** GET /v1/workspaces/:ws/tickets item (newest change first). */
export interface TicketSummary {
  id: string;
  no: string;
  title: string;
  status: TicketStatus;
  priority: string;
  current_round: number;
  reporter_name: string | null;
  /** why the current round needs help */
  help_reason: string | null;
  /** the caller is one of its assignees ("我的") */
  is_assignee: boolean;
  updated_at: string;
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
  /** the caller is one of the ticket's assignees (only they review, 05 step 4) */
  is_assignee: boolean;
  rounds: {
    round_no: number;
    started_at: string;
    /** new, code_rejected … (06 §2.5 rounds.cause) */
    cause: string;
    status: RoundStatus;
    reason: string | null;
    flow_id: string | null;
    review_rev: number;
    delivery: DeliveryCard | null;
    review: {
      result: 'approved' | 'rejected';
      reviewer_id: string;
      comment: string | null;
      reject_category: string | null;
      location: ReviewRequest['location'] | null;
      at: string;
    } | null;
  }[];
}
