// The delivery segment of a ticket (docs/06 §3.3, §2.6; 05 steps 5–12): merge to the test branch,
// release to test, retest, merge back to main, release to production. One delivery flow per approved
// round; its node runs are the progress, merge_requests / release_tasks / test_records the records.
import { Type, type Static } from 'typebox';

/** release_tasks.status (06 §3.3) */
export const RELEASE_STATUSES = [
  'waiting_lock',
  'waiting_human',
  'running',
  'paused',
  'failed',
  'effective_pending_retest',
  'effective',
  'retest_rejected',
  'superseded',
  'cancelled',
] as const;
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];

/** release_steps.slot (06 §7.1 craft slots + notify) */
export const RELEASE_SLOTS = ['build', 'publish', 'release', 'verify', 'notify'] as const;
export type ReleaseSlot = (typeof RELEASE_SLOTS)[number];

export const MR_STATES = ['open', 'merged', 'rejected', 'superseded', 'closed'] as const;
export type MrState = (typeof MR_STATES)[number];

/** 「发布到测试环境」(05 step 5): the latest approved round of the ticket goes to the test environment. */
export const StartTestReleaseRequest = Type.Object({
  round_no: Type.Integer({ minimum: 1 }),
  /** a test_gate environment of the project; default the first one */
  environment_id: Type.Optional(Type.String({ format: 'uuid' })),
  /** who retests (05 step 5: default the reporter) */
  tester_id: Type.Optional(Type.String({ format: 'uuid' })),
});
export type StartTestReleaseRequest = Static<typeof StartTestReleaseRequest>;

/** The MR reviewer approves and merges, or sends the ticket back (05 steps 6, 10). */
export const MergeReviewRequest = Type.Object({
  decision: Type.Union([Type.Literal('approve'), Type.Literal('reject')]),
  /** the source head the reviewer saw; a newer push makes this 409 (06 §6.3) */
  expected_head_sha: Type.String({ pattern: '^[0-9a-f]{40}$' }),
  comment: Type.Optional(Type.String({ maxLength: 5000 })),
});
export type MergeReviewRequest = Static<typeof MergeReviewRequest>;

/** The tester passes or sends back the version on the test environment (05 step 9). */
export const RetestRequest = Type.Object({
  decision: Type.Union([Type.Literal('pass'), Type.Literal('reject')]),
  release_task_id: Type.String({ format: 'uuid' }),
  comment: Type.Optional(Type.String({ maxLength: 5000 })),
});
export type RetestRequest = Static<typeof RetestRequest>;

/** 「从这一步重试」(06 §3.3): the failed step runs again with the account of whoever clicked. */
export const RetryDeliveryRequest = Type.Object({
  node_key: Type.String({ minLength: 1, maxLength: 64 }),
});
export type RetryDeliveryRequest = Static<typeof RetryDeliveryRequest>;

/** A person's own account on a shared connector (设置 → 我的账号, 01 PC-第一次发布-配账号). */
export const SavePersonalAccountRequest = Type.Object({
  credential: Type.Record(Type.String(), Type.Unknown()),
});
export type SavePersonalAccountRequest = Static<typeof SavePersonalAccountRequest>;

/** Who may do a delivery action (06 §2.4 unified policy); names of `users` are in DeliveryView.people. */
export interface ActorPolicyView {
  type: 'assignee' | 'anyone' | 'users' | 'reporter';
  users?: string[];
}

export interface PersonalAccountRow {
  connector_id: string;
  connector_name: string;
  plugin_id: string;
  category: string;
  personal_auth_schema: unknown;
  /** null: not set up yet */
  account: { identity: string | null; hint: string; updated_at: string } | null;
}

export interface DeliveryNodeView {
  key: string;
  /** cr_merge / release_deploy / human_gate */
  node_kind: string;
  /** open / review / merge / request (cr_merge, release_deploy) or the craft slot */
  step: string;
  /** environment the node is about (test / production stage) */
  stage: 'test' | 'retest' | 'main' | 'production';
  status: 'pending' | 'running' | 'waiting_human' | 'done' | 'failed' | 'cancelled';
  attempt_no: number;
  started_at: string | null;
  finished_at: string | null;
  /** failed: the reason; "interrupted" when the executor died with an outside change in flight */
  error: string | null;
}

export interface MergeRequestView {
  id: string;
  direction: 'to_env' | 'to_main';
  repo: string;
  external_iid: string | null;
  web_url: string | null;
  source_branch: string;
  target_branch: string;
  head_sha: string | null;
  merge_sha: string | null;
  state: MrState;
  reviewer_id: string | null;
  merged_by: string | null;
  comment: string | null;
  created_at: string;
}

export interface ReleaseStepView {
  slot: ReleaseSlot;
  status: 'running' | 'succeeded' | 'failed' | 'skipped';
  command: string | null;
  exit_code: number | null;
  error: string | null;
  attempt: number;
  /** the step's last log lines, credentials replaced */
  log_tail: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface ReleaseTaskView {
  id: string;
  no: string;
  environment: { id: string; env_code: string; name: string; tier: string };
  repo: string;
  status: ReleaseStatus;
  source_branch: string;
  build_commit: string | null;
  version: string | null;
  verified_revision: string | null;
  triggered_by: string | null;
  created_at: string;
  steps: ReleaseStepView[];
}

export interface TestRecordView {
  id: string;
  release_task_id: string;
  version: string | null;
  tester_id: string;
  result: 'pending' | 'passed' | 'rejected';
  comment: string | null;
  at: string;
}

/** GET /v1/workspaces/:ws/tickets/:id/delivery */
export interface DeliveryView {
  ticket_id: string;
  /** null until someone releases the approved round to test */
  flow: { id: string; round_no: number; status: string } | null;
  nodes: DeliveryNodeView[];
  merge_requests: MergeRequestView[];
  release_tasks: ReleaseTaskView[];
  test_records: TestRecordView[];
  /** 发正式的三项前置, computed on every read (06 §2.6) */
  prod_gates: { code_review: boolean; retest: boolean; main_merged: boolean };
  /** what the caller may do now (ActionGate) */
  can: {
    start_test: boolean;
    review_mr: boolean;
    retest: boolean;
    request_main: boolean;
    release_prod: boolean;
    retry: string | null;
  };
  /** personal accounts the next action needs but the caller has not set up (connector ids) */
  missing_accounts: string[];
  /**
   * The project's environments with the version last made live there by a release of this
   * workspace (computed from release_tasks; null when nothing was released yet).
   */
  environments: {
    id: string;
    env_code: string;
    name: string;
    tier: string;
    entry_url: string;
    live_version: string | null;
  }[];
  /** the release settings of the ticket's target; null when the project has none yet */
  config: {
    provider_connector_id: string;
    /** the code source the MRs go through (the reviewer's own account merges) */
    code_connector_id: string | null;
    test_branch: string | null;
    main_branch: string;
    test_reviewers: ActorPolicyView;
    main_reviewers: ActorPolicyView;
    test_deployers: ActorPolicyView;
    prod_deployers: ActorPolicyView;
  } | null;
  /** who retests: the flow's tester, or before it starts the default (the reporter) */
  tester_id: string | null;
  /** display names of everyone the view refers to */
  people: Record<string, string>;
}
