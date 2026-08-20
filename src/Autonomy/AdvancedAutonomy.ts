import { AutonomyLevel, PRPreparation, IntelligenceFeed } from './Phase9Types';

/**
 * AutonomyClassifier — classifies actions into autonomy levels.
 *
 * Level 1 (Autonomous): research, monitoring, analysis, summaries,
 *   memory updates, internal task creation, non-destructive diagnostics,
 *   opportunity discovery.
 *
 * Level 2 (Prepare): code changes, branches, PR preparation, application
 *   drafts, deployment plans, integration proposals.
 *   "Sensitive final actions require approval."
 *
 * Level 3 (Approval Required): production deployment, moving funds,
 *   deleting production data, rotating critical credentials, changing
 *   wallet security, submitting legal documents, signing binding agreements,
 *   irreversible financial actions.
 */
export class AutonomyClassifier {
  private level1Actions = [
    'research', 'monitor', 'analyze', 'summarize', 'memory_update',
    'create_internal_task', 'diagnose', 'discover_opportunity',
    'read', 'scan', 'list', 'query', 'check_status',
  ];

  private level2Actions = [
    'code_change', 'create_branch', 'prepare_pr', 'draft_application',
    'plan_deployment', 'propose_integration', 'write_code',
    'create_file', 'edit_file', 'commit',
  ];

  private level3Actions = [
    'deploy_to_production', 'move_funds', 'send_payment', 'transfer_assets',
    'delete_production_data', 'rotate_credentials', 'change_wallet_security',
    'submit_legal_document', 'sign_agreement', 'irreversible_financial',
    'delete_database', 'update_secrets',
  ];

  classify(action: string): { level: AutonomyLevel; description: string; requiresApproval: boolean } {
    const normalized = action.toLowerCase().replace(/\s+/g, '_');

    // Check Level 3 first (most restrictive)
    for (const l3 of this.level3Actions) {
      if (normalized.includes(l3)) {
        return { level: 3, description: 'Approval required — consequential action', requiresApproval: true };
      }
    }

    // Check Level 2
    for (const l2 of this.level2Actions) {
      if (normalized.includes(l2)) {
        return { level: 2, description: 'Prepare — final action requires approval', requiresApproval: true };
      }
    }

    // Check Level 1
    for (const l1 of this.level1Actions) {
      if (normalized.includes(l1)) {
        return { level: 1, description: 'Autonomous — safe to execute', requiresApproval: false };
      }
    }

    // Default to Level 2 (prepare) for unknown actions
    return { level: 2, description: 'Prepare — unknown action, treat with caution', requiresApproval: true };
  }

  // ── Batch classify ─────────────────────────────────────────────────
  classifyBatch(actions: string[]): { action: string; level: AutonomyLevel; requiresApproval: boolean }[] {
    return actions.map(action => {
      const { level, requiresApproval } = this.classify(action);
      return { action, level, requiresApproval };
    });
  }

  // ── Check if action is allowed at a given level ────────────────────
  isAllowed(action: string, currentLevel: AutonomyLevel): boolean {
    const { level } = this.classify(action);
    return level <= currentLevel;
  }
}

/**
 * PRPreparationManager — Level 2 autonomy: prepare PRs for review.
 *
 * "PR preparation" from Phase 9 spec.
 * The system can prepare code changes, create branches, and draft PRs
 * but merging/deploying requires approval.
 */
export class PRPreparationManager {
  private prs: Map<string, PRPreparation> = new Map();

  // ── Draft a PR ────────────────────────────────────────────────────
  draft(
    title: string,
    branch: string,
    baseBranch: string,
    description: string,
    filesChanged: string[],
    commits: string[],
    acceptanceCriteria: string[],
  ): PRPreparation {
    const pr: PRPreparation = {
      id: `pr-prep:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
      title, branch, baseBranch, description,
      filesChanged, commits, acceptanceCriteria,
      status: 'draft',
      createdAt: Date.now(),
    };
    this.prs.set(pr.id, pr);
    return pr;
  }

  // ── Mark as ready ─────────────────────────────────────────────────
  markReady(id: string): void {
    const pr = this.prs.get(id);
    if (pr) pr.status = 'ready';
  }

  // ── Mark as submitted ──────────────────────────────────────────────
  markSubmitted(id: string): void {
    const pr = this.prs.get(id);
    if (pr) {
      pr.status = 'submitted';
      pr.submittedAt = Date.now();
    }
  }

  // ── Mark as merged ────────────────────────────────────────────────
  markMerged(id: string): void {
    const pr = this.prs.get(id);
    if (pr) pr.status = 'merged';
  }

  // ── Mark as rejected ───────────────────────────────────────────────
  markRejected(id: string): void {
    const pr = this.prs.get(id);
    if (pr) pr.status = 'rejected';
  }

  // ── Query ─────────────────────────────────────────────────────────
  getPRs(filter?: { status?: string }): PRPreparation[] {
    let results = Array.from(this.prs.values());
    if (filter?.status) results = results.filter(p => p.status === filter.status);
    return results.sort((a, b) => b.createdAt - a.createdAt);
  }

  getReadyPRs(): PRPreparation[] {
    return this.getPRs({ status: 'ready' });
  }

  getStats() {
    const all = Array.from(this.prs.values());
    return {
      total: all.length,
      draft: all.filter(p => p.status === 'draft').length,
      ready: all.filter(p => p.status === 'ready').length,
      submitted: all.filter(p => p.status === 'submitted').length,
      merged: all.filter(p => p.status === 'merged').length,
      rejected: all.filter(p => p.status === 'rejected').length,
    };
  }
}

/**
 * ContinuousIntelligence — "Continuous company intelligence" from Phase 9.
 *
 * Maintains a live feed of intelligence items that the system discovers
 * while CozyCrypto is offline or working on other things.
 */
export class ContinuousIntelligence {
  private feed: Map<string, IntelligenceFeed> = new Map();

  add(item: Omit<IntelligenceFeed, 'id' | 'timestamp' | 'acknowledged'>): IntelligenceFeed {
    const entry: IntelligenceFeed = {
      ...item,
      id: `intel:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      acknowledged: false,
    };
    this.feed.set(entry.id, entry);
    return entry;
  }

  acknowledge(id: string): void {
    const item = this.feed.get(id);
    if (item) item.acknowledged = true;
  }

  acknowledgeAll(): number {
    let count = 0;
    for (const item of this.feed.values()) {
      if (!item.acknowledged) {
        item.acknowledged = true;
        count++;
      }
    }
    return count;
  }

  getFeed(filter?: { acknowledged?: boolean; category?: string; minRelevance?: number }): IntelligenceFeed[] {
    let results = Array.from(this.feed.values());
    if (filter?.acknowledged !== undefined) results = results.filter(i => i.acknowledged === filter.acknowledged);
    if (filter?.category) results = results.filter(i => i.category === filter.category);
    if (filter?.minRelevance) results = results.filter(i => i.relevance >= filter.minRelevance!);
    return results.sort((a, b) => b.timestamp - a.timestamp);
  }

  getUnacknowledged(): IntelligenceFeed[] {
    return this.getFeed({ acknowledged: false });
  }

  getHighRelevance(): IntelligenceFeed[] {
    return this.getFeed({ minRelevance: 70 });
  }

  getStats() {
    const all = Array.from(this.feed.values());
    return {
      total: all.length,
      acknowledged: all.filter(i => i.acknowledged).length,
      unacknowledged: all.filter(i => !i.acknowledged).length,
      highRelevance: all.filter(i => i.relevance >= 70).length,
      avgRelevance: all.length > 0 ? Math.round(all.reduce((s, i) => s + i.relevance, 0) / all.length) : 0,
    };
  }
}
