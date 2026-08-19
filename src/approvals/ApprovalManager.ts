import { ApprovalRequest, ApprovalEvent, PermissionLevel, RiskLevel } from './types';

type ApprovalEventHandler = (event: ApprovalEvent) => void;

// ── Risk → expiry mapping ──────────────────────────────────────────────
const RISK_EXPIRY_MS: Record<RiskLevel, number> = {
  critical: 5 * 60 * 1000,        // 5 minutes
  high: 30 * 60 * 1000,           // 30 minutes
  medium: 2 * 60 * 60 * 1000,     // 2 hours
  low: 24 * 60 * 60 * 1000,       // 24 hours
};

// ── Action classification rules ────────────────────────────────────────
const LEVEL1_KEYWORDS = [
  'research', 'monitor', 'analyze', 'analysis', 'summarize', 'summary',
  'memory', 'read', 'list', 'inspect', 'diagnose', 'discover', 'observe',
];

const LEVEL2_KEYWORDS = [
  'code', 'branch', 'pr', 'pull request', 'draft', 'deploy plan',
  'integration proposal', 'build', 'compile', 'test', 'commit',
];

const LEVEL3_KEYWORDS = [
  'production deploy', 'move funds', 'transfer', 'delete production',
  'rotate credentials', 'wallet security', 'legal', 'sign agreement',
  'irreversible', 'financial action', 'submit legal',
];

/**
 * ApprovalManager — 3-tier permission system for CozanetOS.
 *
 * Level 1 (Autonomous): research, monitoring, analysis, summaries — no approval needed.
 * Level 2 (Prepare): code changes, branches, PRs — prepare but don't execute final action.
 * Level 3 (Approval Required): production deploys, moving funds, deleting prod data.
 *
 * Every Level 3 action generates an Approval Object (Section 35):
 *   Action, Reason, Changes, Tests, Risk, Rollback, Approval required
 */
export class ApprovalManager {
  private static instance: ApprovalManager | null = null;
  private requests: Map<string, ApprovalRequest> = new Map();
  private handlers: ApprovalEventHandler[] = [];

  private constructor() {}

  static getInstance(): ApprovalManager {
    if (!ApprovalManager.instance) {
      ApprovalManager.instance = new ApprovalManager();
    }
    return ApprovalManager.instance;
  }

  // ── Action classification ──────────────────────────────────────────
  checkPermission(action: string): PermissionLevel {
    const lower = action.toLowerCase();

    for (const kw of LEVEL3_KEYWORDS) {
      if (lower.includes(kw)) return 'approval_required';
    }
    for (const kw of LEVEL2_KEYWORDS) {
      if (lower.includes(kw)) return 'prepare';
    }
    for (const kw of LEVEL1_KEYWORDS) {
      if (lower.includes(kw)) return 'autonomous';
    }

    // Default to approval_required for unclassified actions (safe default)
    return 'approval_required';
  }

  hasAutoApproval(action: string): boolean {
    return this.checkPermission(action) === 'autonomous';
  }

  // ── Request lifecycle ──────────────────────────────────────────────
  requestApproval(request: Omit<ApprovalRequest, 'id' | 'status' | 'requestedAt' | 'expiresAt'>): ApprovalRequest {
    const id = `approval:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`;
    const expiryMs = RISK_EXPIRY_MS[request.risk] ?? RISK_EXPIRY_MS.medium;

    const full: ApprovalRequest = {
      ...request,
      id,
      status: 'pending',
      requestedAt: Date.now(),
      expiresAt: Date.now() + expiryMs,
    };

    this.requests.set(id, full);
    this.emit({ type: 'requested', requestId: id, timestamp: Date.now(), data: { action: request.action, risk: request.risk } });

    console.log(`[ApprovalManager] Approval requested: "${request.action}" (risk: ${request.risk}, expires in ${expiryMs / 1000}s)`);
    return full;
  }

  approve(requestId: string, decidedBy: string): ApprovalRequest | null {
    const req = this.requests.get(requestId);
    if (!req) return null;
    if (req.status !== 'pending') return null;

    req.status = 'approved';
    req.decidedAt = Date.now();
    req.decidedBy = decidedBy;
    req.decision = 'approved';

    this.emit({ type: 'approved', requestId, timestamp: Date.now(), data: { decidedBy } });
    console.log(`[ApprovalManager] Approved: "${req.action}" by ${decidedBy}`);
    return req;
  }

  reject(requestId: string, decidedBy: string, reason?: string): ApprovalRequest | null {
    const req = this.requests.get(requestId);
    if (!req) return null;
    if (req.status !== 'pending') return null;

    req.status = 'rejected';
    req.decidedAt = Date.now();
    req.decidedBy = decidedBy;
    req.decision = 'rejected';
    req.rejectionReason = reason;

    this.emit({ type: 'rejected', requestId, timestamp: Date.now(), data: { decidedBy, reason } });
    console.log(`[ApprovalManager] Rejected: "${req.action}" by ${decidedBy}${reason ? ` — ${reason}` : ''}`);
    return req;
  }

  // ── Querying ───────────────────────────────────────────────────────
  getApproval(requestId: string): ApprovalRequest | null {
    return this.requests.get(requestId) ?? null;
  }

  getPendingApprovals(): ApprovalRequest[] {
    return Array.from(this.requests.values()).filter(r => r.status === 'pending');
  }

  getApprovalHistory(): ApprovalRequest[] {
    return Array.from(this.requests.values()).sort((a, b) => b.requestedAt - a.requestedAt);
  }

  // ── Expiry ─────────────────────────────────────────────────────────
  expireOldApprovals(): number {
    let expired = 0;
    const now = Date.now();

    for (const req of this.requests.values()) {
      if (req.status === 'pending' && req.expiresAt <= now) {
        req.status = 'expired';
        req.decidedAt = now;
        this.emit({ type: 'expired', requestId: req.id, timestamp: now });
        expired++;
      }
    }

    if (expired > 0) {
      console.log(`[ApprovalManager] Expired ${expired} old approval(s)`);
    }
    return expired;
  }

  // ── Events ─────────────────────────────────────────────────────────
  on(handler: ApprovalEventHandler): void {
    this.handlers.push(handler);
  }

  private emit(event: ApprovalEvent): void {
    for (const h of this.handlers) {
      try { h(event); } catch { /* swallow */ }
    }
  }
}
