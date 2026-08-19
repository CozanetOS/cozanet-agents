// ── Shared types for ApprovalManager ──────────────────────────────────

export type PermissionLevel = 'autonomous' | 'prepare' | 'approval_required';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export type ApprovalDecision = 'approved' | 'rejected';

export interface ApprovalRequest {
  id: string;
  action: string;
  reason: string;
  changes: string;
  tests: string;
  risk: RiskLevel;
  rollback: string | null;
  level: PermissionLevel;
  status: ApprovalStatus;
  requestedBy: string; // agent id
  requestedAt: number;
  decidedAt?: number;
  decidedBy?: string;
  decision?: ApprovalDecision;
  rejectionReason?: string;
  expiresAt: number;
}

export interface ApprovalEvent {
  type: 'requested' | 'approved' | 'rejected' | 'expired';
  requestId: string;
  timestamp: number;
  data?: any;
}
