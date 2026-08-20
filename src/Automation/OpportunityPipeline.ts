import {
  Opportunity, OpportunityTask, OpportunityStatus, OpportunityCategory,
} from './Phase6Types';
import { RadarFinding, FundingOpportunity } from '../Intelligence/types';

/**
 * OpportunityPipeline — Section 13 (Opportunity Engine) + Section 39 (Opportunity → Task Pipeline).
 *
 * Flow:
 *   DISCOVERY → ANALYSIS → RELEVANCE → RECOMMENDATION → TASK → PRIORITIZATION → EXECUTION
 *
 * "The AI must not simply collect information.
 *  Every discovery should pass through:
 *  WHAT CHANGED? → WHY DOES IT MATTER? → DOES IT AFFECT COZANET? →
 *  IS THERE AN OPPORTUNITY? → IS THERE A RISK? → CAN WE ACT? →
 *  WHAT IS THE SMALLEST USEFUL ACTION?"
 *
 * Section 40: "Discovery does not equal authorization."
 * interesting → evaluated → approved → implemented → tested → deployed
 */
export class OpportunityPipeline {
  private opportunities: Map<string, Opportunity> = new Map();
  private tasks: Map<string, OpportunityTask> = new Map();

  // ── Stage 1: DISCOVERY — ingest a finding from the radar ──────────
  discover(finding: RadarFinding): Opportunity {
    const opp: Opportunity = {
      id: `opp:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
      title: finding.title,
      source: finding.source ?? finding.url ?? 'radar',
      category: this.mapRadarToCategory(finding.radar),
      description: finding.description,
      fitScore: 0,       // will be calculated in analysis
      urgency: 'medium',  // will be assessed
      effort: 'medium',   // will be assessed
      confidence: 50,     // will be assessed
      recommendation: '',  // will be generated
      status: 'DISCOVERED',
      evidence: [finding.description],
      discoveredAt: finding.timestamp,
      updatedAt: Date.now(),
      metadata: finding.metadata,
    };

    this.opportunities.set(opp.id, opp);
    return opp;
  }

  // ── Stage 1b: DISCOVERY — ingest a funding opportunity ────────────
  discoverFunding(funding: FundingOpportunity): Opportunity {
    const opp: Opportunity = {
      id: `opp:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
      title: funding.name,
      source: funding.provider,
      category: 'funding',
      description: `${funding.type} from ${funding.provider}${funding.amount ? ` — ${funding.currency ?? ''}${funding.amount}` : ''}`,
      funding: funding.amount,
      deadline: funding.deadline,
      eligibility: funding.eligibility,
      fitScore: 0,
      urgency: 'medium',
      effort: 'medium',
      confidence: 50,
      recommendation: '',
      status: 'DISCOVERED',
      evidence: [funding.name, funding.type, funding.provider],
      discoveredAt: funding.discoveredAt,
      updatedAt: Date.now(),
      metadata: { url: funding.url, relevance: funding.relevance },
    };

    this.opportunities.set(opp.id, opp);
    return opp;
  }

  // ── Stage 2: ANALYSIS — assess fit, urgency, effort, confidence ──
  analyze(opportunityId: string): Opportunity {
    const opp = this.opportunities.get(opportunityId);
    if (!opp) throw new Error(`Opportunity not found: ${opportunityId}`);

    opp.status = 'REVIEWING';
    opp.updatedAt = Date.now();

    // Calculate fit score (0-100)
    opp.fitScore = this.calculateFitScore(opp);

    // Assess urgency
    opp.urgency = this.assessUrgency(opp);

    // Assess effort
    opp.effort = this.assessEffort(opp);

    // Calculate confidence
    opp.confidence = this.assessConfidence(opp);

    // Generate recommendation
    opp.recommendation = this.generateRecommendation(opp);

    return opp;
  }

  // ── Stage 3: RELEVANCE — should we care? ───────────────────────────
  assessRelevance(opportunityId: string): { relevant: boolean; score: number; reason: string } {
    const opp = this.opportunities.get(opportunityId);
    if (!opp) throw new Error(`Opportunity not found: ${opportunityId}`);

    const relevant = opp.fitScore >= 40;
    const reason = relevant
      ? `Fit score ${opp.fitScore}/100 — this aligns with Cozanet/AEGIS priorities`
      : `Fit score ${opp.fitScore}/100 — low relevance to current priorities`;

    return { relevant, score: opp.fitScore, reason };
  }

  // ── Stage 4: RECOMMENDATION — what should we do? ──────────────────
  recommend(opportunityId: string): { action: 'create_task' | 'monitor' | 'ignore'; reason: string } {
    const opp = this.opportunities.get(opportunityId);
    if (!opp) throw new Error(`Opportunity not found: ${opportunityId}`);

    const relevance = this.assessRelevance(opportunityId);

    if (!relevance.relevant) {
      opp.status = 'IGNORED';
      opp.updatedAt = Date.now();
      return { action: 'ignore', reason: relevance.reason };
    }

    if (opp.fitScore >= 70 && opp.urgency !== 'low') {
      opp.status = 'RECOMMENDED';
      opp.updatedAt = Date.now();
      return { action: 'create_task', reason: `High fit (${opp.fitScore}) + ${opp.urgency} urgency — create task immediately` };
    }

    // Medium relevance — monitor
    opp.status = 'RECOMMENDED';
    opp.updatedAt = Date.now();
    return { action: 'monitor', reason: `Medium fit (${opp.fitScore}) — monitor for changes` };
  }

  // ── Stage 5: TASK — convert opportunity to a work item ─────────────
  createTask(opportunityId: string, acceptanceCriteria?: string[]): OpportunityTask {
    const opp = this.opportunities.get(opportunityId);
    if (!opp) throw new Error(`Opportunity not found: ${opportunityId}`);

    // Section 39 example: "AEGIS-EVAL-PROVIDER-X"
    const taskPrefix = this.getTaskPrefix(opp.category);
    const taskTitle = `${taskPrefix}-${opp.title.toUpperCase().replace(/\s+/g, '-').slice(0, 40)}`;

    const criteria = acceptanceCriteria ?? this.generateAcceptanceCriteria(opp);

    const task: OpportunityTask = {
      id: `task:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
      opportunityId,
      title: taskTitle,
      description: opp.description,
      acceptanceCriteria: criteria,
      priority: opp.urgency === 'critical' ? 'critical' : opp.urgency === 'high' ? 'high' : opp.urgency === 'medium' ? 'medium' : 'low',
      status: 'pending',
      createdAt: Date.now(),
      metadata: { fitScore: opp.fitScore, category: opp.category, source: opp.source },
    };

    this.tasks.set(task.id, task);
    return task;
  }

  // ── Stage 6: PRIORITIZATION — rank tasks ───────────────────────────
  prioritizeTasks(): OpportunityTask[] {
    const pending = Array.from(this.tasks.values()).filter(t => t.status === 'pending');
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return pending.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  // ── Stage 7: EXECUTION — mark task status ─────────────────────────
  updateTaskStatus(taskId: string, status: OpportunityTask['status']): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = status;
    }
  }

  // ── Update opportunity status ─────────────────────────────────────
  updateOpportunityStatus(id: string, status: OpportunityStatus): void {
    const opp = this.opportunities.get(id);
    if (opp) {
      opp.status = status;
      opp.updatedAt = Date.now();
    }
  }

  // ── Queries ───────────────────────────────────────────────────────
  getOpportunities(filter?: { status?: OpportunityStatus; category?: OpportunityCategory }): Opportunity[] {
    let results = Array.from(this.opportunities.values());
    if (filter?.status) results = results.filter(o => o.status === filter.status);
    if (filter?.category) results = results.filter(o => o.category === filter.category);
    return results.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getTasks(filter?: { status?: string; priority?: string }): OpportunityTask[] {
    let results = Array.from(this.tasks.values());
    if (filter?.status) results = results.filter(t => t.status === filter.status);
    if (filter?.priority) results = results.filter(t => t.priority === filter.priority);
    return results.sort((a, b) => a.createdAt - b.createdAt);
  }

  getOpportunity(id: string): Opportunity | null {
    return this.opportunities.get(id) ?? null;
  }

  // ── Full pipeline: discovery → task in one call ────────────────────
  processDiscovery(finding: RadarFinding): { opportunity: Opportunity; task?: OpportunityTask; recommendation: string } {
    // Stage 1: Discover
    const opp = this.discover(finding);

    // Stage 2: Analyze
    this.analyze(opp.id);

    // Stage 3-4: Relevance + Recommendation
    const rec = this.recommend(opp.id);

    // Stage 5: Create task if recommended
    let task: OpportunityTask | undefined;
    if (rec.action === 'create_task') {
      task = this.createTask(opp.id);
    }

    return {
      opportunity: this.getOpportunity(opp.id)!,
      task,
      recommendation: rec.reason,
    };
  }

  // ── Private helpers ───────────────────────────────────────────────

  private mapRadarToCategory(radar: string): OpportunityCategory {
    const map: Record<string, OpportunityCategory> = {
      funding: 'funding',
      competitor: 'market',
      technology: 'technology',
      regulatory: 'regulatory',
      security: 'security',
      ecosystem: 'partnership',
      product: 'product',
    };
    return map[radar] ?? 'market';
  }

  private calculateFitScore(opp: Opportunity): number {
    let score = 50; // baseline

    // Funding opportunities: high fit if deadline is approaching
    if (opp.category === 'funding') {
      score += 20;
      if (opp.deadline) {
        const days = Math.ceil((new Date(opp.deadline).getTime() - Date.now()) / 86400000);
        if (days <= 14) score += 15;
        if (days <= 7) score += 10;
        if (days <= 0) score -= 30; // expired
      }
      // Check eligibility matches
      if (opp.eligibility) {
        const matches = opp.eligibility.some(e =>
          e.toLowerCase().includes('bep') || e.toLowerCase().includes('bnb') ||
          e.toLowerCase().includes('stellar') || e.toLowerCase().includes('soroban') ||
          e.toLowerCase().includes('fintech') || e.toLowerCase().includes('africa') ||
          e.toLowerCase().includes('ai') || e.toLowerCase().includes('web3')
        );
        if (matches) score += 10;
      }
    }

    // Security: always high fit
    if (opp.category === 'security') {
      score += 25;
    }

    // Regulatory: high fit if affects our products
    if (opp.category === 'regulatory') {
      score += 15;
    }

    // Technology: medium fit
    if (opp.category === 'technology') {
      score += 5;
    }

    // Partnerships/ecosystem: medium fit
    if (opp.category === 'partnership') {
      score += 10;
    }

    // Clamp
    return Math.max(0, Math.min(100, score));
  }

  private assessUrgency(opp: Opportunity): 'low' | 'medium' | 'high' | 'critical' {
    // Security = critical
    if (opp.category === 'security') return 'critical';

    // Funding with short deadline = high
    if (opp.category === 'funding' && opp.deadline) {
      const days = Math.ceil((new Date(opp.deadline).getTime() - Date.now()) / 86400000);
      if (days <= 7) return 'high';
      if (days <= 30) return 'medium';
      return 'low';
    }

    // Regulatory = medium-high
    if (opp.category === 'regulatory') return 'high';

    // Default
    return 'medium';
  }

  private assessEffort(opp: Opportunity): 'low' | 'medium' | 'high' {
    if (opp.category === 'funding') return 'medium'; // grant applications
    if (opp.category === 'security') return 'low';  // patch/upgrade
    if (opp.category === 'regulatory') return 'high'; // legal review
    if (opp.category === 'technology') return 'medium'; // evaluation
    return 'medium';
  }

  private assessConfidence(opp: Opportunity): number {
    let confidence = 60;
    if (opp.evidence.length > 1) confidence += 10;
    if (opp.metadata?.url) confidence += 10;
    if (opp.deadline) confidence += 5;
    return Math.min(100, confidence);
  }

  private generateRecommendation(opp: Opportunity): string {
    const relevance = opp.fitScore >= 70 ? 'High' : opp.fitScore >= 40 ? 'Medium' : 'Low';
    return `${relevance} relevance (fit: ${opp.fitScore}/100). ${opp.urgency} urgency, ${opp.effort} effort. ${opp.confidence}% confidence.`;
  }

  private getTaskPrefix(category: OpportunityCategory): string {
    const prefixes: Record<OpportunityCategory, string> = {
      funding: 'FUND',
      partnership: 'PARTNER',
      technology: 'EVAL',
      regulatory: 'COMPLIANCE',
      security: 'SEC',
      market: 'MARKET',
      product: 'PRODUCT',
    };
    return prefixes[category];
  }

  private generateAcceptanceCriteria(opp: Opportunity): string[] {
    if (opp.category === 'funding') {
      return [
        'Eligibility confirmed',
        'Application requirements reviewed',
        'Deadline verified',
        'Application submitted',
      ];
    }
    if (opp.category === 'security') {
      return [
        'Vulnerability confirmed',
        'Patch/upgrade available',
        'Fix applied',
        'Verification test passes',
      ];
    }
    if (opp.category === 'technology') {
      return [
        'API reviewed',
        'Pricing compared',
        'Sandbox tested',
        'Architectural fit determined',
      ];
    }
    if (opp.category === 'regulatory') {
      return [
        'Regulation reviewed',
        'Affected products identified',
        'Legal review scheduled',
        'Compliance plan created',
      ];
    }
    return [
      'Opportunity reviewed',
      'Decision documented',
      'Action taken or deferred',
    ];
  }

  // ── Stats ─────────────────────────────────────────────────────────
  getStats() {
    const all = Array.from(this.opportunities.values());
    return {
      total: all.length,
      discovered: all.filter(o => o.status === 'DISCOVERED').length,
      reviewing: all.filter(o => o.status === 'REVIEWING').length,
      recommended: all.filter(o => o.status === 'RECOMMENDED').length,
      ignored: all.filter(o => o.status === 'IGNORED').length,
      applying: all.filter(o => o.status === 'APPLYING').length,
      submitted: all.filter(o => o.status === 'SUBMITTED').length,
      tasksCreated: this.tasks.size,
      pendingTasks: Array.from(this.tasks.values()).filter(t => t.status === 'pending').length,
    };
  }
}
