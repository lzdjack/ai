import type { ApprovalStatus } from '@demo/lib';

export interface FlowNode {
  name: string;
  approver_name: string;
  result: 'waiting' | 'approved' | 'rejected';
}

export interface Approval {
  id: string;
  title: string;
  applicant_id: string;
  applicant_name: string;
  amount: number;
  reason: string;
  status: ApprovalStatus;
  submitted_at: string;
  nodes: FlowNode[];
}

export interface NewApproval {
  title: string;
  amount: number;
  reason: string;
}

export interface User {
  id: string;
  name: string;
}
