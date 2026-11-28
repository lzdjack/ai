// View models of the workbench panels. P4 maps the API's ticket DTOs (core-protocol) onto these; U1
// feeds them sample data shaped like the approved design.

/** Status colours of 01 §3.3: review blue, blocked / asking orange, fixing teal, passed green, action red. */
export type StatusTone = 'blue' | 'orange' | 'teal' | 'green' | 'red' | 'gray';

/** Groups of the ticket list, by "what is waiting on you" (01 §3.3). */
export type TicketGroupKey =
  | 'need_action'
  | 'waiting_you'
  | 'bot_asking'
  | 'bot_fixing'
  | 'queued'
  | 'releasing'
  | 'platform_confirm'
  | 'done';

export interface TicketRowVM {
  id: string;
  title: string;
  /** tone: fixed avatar colour (0–5), otherwise picked from the name */
  reporter: { name: string; label: string; system?: boolean; tone?: number };
  status: StatusTone;
  /** connector name of the source, e.g. Tita / Jira; manual tickets have none */
  source?: string;
  /** the source pill is drawn outlined (a second connector style) */
  sourceOutline?: boolean;
  note: string;
  noteTone?: 'orange' | 'red';
  time?: string;
  unread?: 'blue' | 'orange';
  /** 0–100 while the Bot is fixing */
  progress?: number;
}

export interface TicketGroupVM {
  key: TicketGroupKey;
  items: TicketRowVM[];
}

export interface EvidenceShotVM {
  image: string;
  /** e.g. 0:18 */
  duration: string;
  seen: boolean;
}

export interface DeliveryVM {
  round: number;
  by: string;
  at: string;
  rootCause: string;
  /** answer to last round's rejection */
  response?: string;
  responseHandled?: boolean;
  before: EvidenceShotVM;
  after: EvidenceShotVM;
  /** where the Bot verified, e.g. test environment · version · role */
  verifiedOn: string;
  checks: { label: string; untested?: boolean }[];
  files: { count: number; add: number; del: number };
  mr: string;
  skills: string[];
}

export type FlowItemVM =
  | { kind: 'divider'; text: string }
  | { kind: 'user'; text: string; note: string }
  | {
      kind: 'bot';
      steps: string[];
      /** e.g. 42 */
      minutes: number;
      delivery?: DeliveryVM;
      review?: { sha: string };
    };

export interface TicketDetailVM {
  id: string;
  source?: { code: string; name: string };
  title: string;
  /** meta line before the priority, the priority, and after it */
  priority: string;
  metaAfter: string;
  state: { tone: StatusTone; text: string };
  counts: { code: number; evidence: number };
  /** extension tabs enabled for the project (e.g. release) */
  extraTabs: { key: string; label: string }[];
  flow: FlowItemVM[];
  rail: {
    timeline: { tone: StatusTone; title: string; sub: string; current?: boolean }[];
    env: { test: string; testNote?: string; prod: string; tester: string };
    progress: {
      codeReviewWaiting: boolean;
      /** when not waiting: e.g. 已通过 */
      codeReview?: string;
      release: string;
      platform: string;
      /** manual tickets have no source ticket to confirm on (01 §3.4) */
      noSource?: boolean;
    };
  };
}
