import { OperatingRule, SuccessCriterion, SystemReport } from './Phase10Types';

/**
 * OperatingConstitution — Section 97: Final Operating Constitution (24 rules).
 *
 * The complete constitution that governs Cozanet OS behavior.
 * Every agent, every action, every decision must comply with these rules.
 *
 * This is the highest-level governance document — all other rules
 * (AEGIS Constitution, SecurityChecker, etc.) derive from these.
 */
export class OperatingConstitution {
  private rules: OperatingRule[] = [
    { number: 1, rule: 'Remember the user.', category: 'memory' },
    { number: 2, rule: 'Remember the work.', category: 'memory' },
    { number: 3, rule: 'Know current state.', category: 'memory' },
    { number: 4, rule: 'Respect domains.', category: 'architecture' },
    { number: 5, rule: 'Use tools instead of pretending.', category: 'process' },
    { number: 6, rule: 'Use deterministic software whenever possible.', category: 'process' },
    { number: 7, rule: 'Research current information.', category: 'process' },
    { number: 8, rule: 'Verify important claims.', category: 'quality' },
    { number: 9, rule: 'Never confuse intention with completion.', category: 'quality' },
    { number: 10, rule: 'Protect secrets and financial operations.', category: 'security' },
    { number: 11, rule: 'Require authorization for consequential actions.', category: 'autonomy' },
    { number: 12, rule: 'Connect before rebuilding.', category: 'architecture' },
    { number: 13, rule: 'Preserve AEGIS architecture.', category: 'architecture' },
    { number: 14, rule: 'Convert useful discoveries into tasks.', category: 'process' },
    { number: 15, rule: 'Suppress low-value noise.', category: 'quality' },
    { number: 16, rule: 'Prioritize high-leverage work.', category: 'process' },
    { number: 17, rule: 'Learn from failures.', category: 'memory' },
    { number: 18, rule: 'Maintain persistent state.', category: 'memory' },
    { number: 19, rule: 'Make long-running work recoverable.', category: 'process' },
    { number: 20, rule: 'Measure system performance, not just model intelligence.', category: 'quality' },
    { number: 21, rule: 'Avoid unnecessary provider lock-in.', category: 'architecture' },
    { number: 22, rule: 'Automate repetitive work.', category: 'process' },
    { number: 23, rule: 'Keep the user in control of consequential decisions.', category: 'autonomy' },
    { number: 24, rule: 'Help CozyCrypto think, decide, build, verify, remember, and improve.', category: 'process' },
  ];

  getRules(): OperatingRule[] {
    return [...this.rules];
  }

  getRule(number: number): OperatingRule | null {
    return this.rules.find(r => r.number === number) ?? null;
  }

  getRulesByCategory(category: OperatingRule['category']): OperatingRule[] {
    return this.rules.filter(r => r.category === category);
  }

  // ── Verify a proposed action against the constitution ─────────────
  verifyAction(action: string, context?: Record<string, any>): { compliant: boolean; violations: string[] } {
    const violations: string[] = [];
    const normalized = action.toLowerCase();

    // Rule 10: Protect secrets
    if (normalized.includes('send') && (normalized.includes('key') || normalized.includes('token') || normalized.includes('secret'))) {
      violations.push('Rule 10: Protect secrets and financial operations');
    }

    // Rule 11: Require authorization
    if (normalized.includes('deploy') && normalized.includes('production')) {
      if (!context?.approved) violations.push('Rule 11: Require authorization for consequential actions');
    }

    // Rule 12: Connect before rebuilding
    if (normalized.includes('build') && normalized.includes('new') && (normalized.includes('provider') || normalized.includes('service'))) {
      if (!context?.checkedExisting) violations.push('Rule 12: Connect before rebuilding — check existing providers first');
    }

    // Rule 9: Never confuse intention with completion
    if (normalized.includes('done') && !context?.verified) {
      violations.push('Rule 9: Never confuse intention with completion — verify the result');
    }

    return { compliant: violations.length === 0, violations };
  }

  // ── Stats ─────────────────────────────────────────────────────────
  getStats() {
    return {
      total: this.rules.length,
      byCategory: {
        memory: this.rules.filter(r => r.category === 'memory').length,
        process: this.rules.filter(r => r.category === 'process').length,
        security: this.rules.filter(r => r.category === 'security').length,
        architecture: this.rules.filter(r => r.category === 'architecture').length,
        autonomy: this.rules.filter(r => r.category === 'autonomy').length,
        quality: this.rules.filter(r => r.category === 'quality').length,
      },
    };
  }
}

/**
 * SuccessCriteria — Section 96: "Cozanet OS succeeds when..."
 *
 * The 8 success criteria that determine whether the system is truly working
 * — not just technically functional, but actually useful to CozyCrypto.
 *
 * 1. Personal: "Continue" → AI knows what that means
 * 2. Engineering: "Continue AEGIS" → system finds correct current task
 * 3. Company: "Check Cozanet" → meaningful company intelligence
 * 4. Research: "Find something useful" → ranked, verified opportunities
 * 5. Automation: system discovers useful changes while offline
 * 6. Execution: system prepares and performs authorized work
 * 7. Verification: system proves whether work succeeded
 * 8. Memory: system remembers decisions, doesn't repeat mistakes
 */
export class SuccessCriteria {
  private criteria: SuccessCriterion[] = [
    { id: 'sc-personal', category: 'personal',
      description: 'CozyCrypto can say "Continue" and the AI knows what that means',
      triggerPhrase: 'Continue', expectedBehavior: 'AI consults memory and project state, resumes where left off',
      verified: false },
    { id: 'sc-engineering', category: 'engineering',
      description: 'CozyCrypto can say "Continue AEGIS" and the system finds the correct current task',
      triggerPhrase: 'Continue AEGIS', expectedBehavior: 'System inspects repo state, identifies current task, works from actual state',
      verified: false },
    { id: 'sc-company', category: 'company',
      description: 'CozyCrypto can say "Check Cozanet" and receive meaningful company intelligence',
      triggerPhrase: 'Check Cozanet', expectedBehavior: 'Returns radar findings, funding opportunities, competitive intel',
      verified: false },
    { id: 'sc-research', category: 'research',
      description: 'CozyCrypto can say "Find something useful" and receive ranked, verified opportunities',
      triggerPhrase: 'Find something useful', expectedBehavior: 'Returns opportunities through pipeline, ranked by fit score',
      verified: false },
    { id: 'sc-automation', category: 'automation',
      description: 'The system can discover useful changes while he is offline',
      triggerPhrase: 'N/A — runs on schedule', expectedBehavior: 'Daily scans run automatically, findings go to pipeline',
      verified: false },
    { id: 'sc-execution', category: 'execution',
      description: 'The system can prepare and perform authorized work',
      triggerPhrase: 'N/A — on demand', expectedBehavior: 'System prepares PRs, plans deployments, executes with approval',
      verified: false },
    { id: 'sc-verification', category: 'verification',
      description: 'The system can prove whether work succeeded',
      triggerPhrase: 'N/A — after execution', expectedBehavior: 'Build tests, health checks, verification reports',
      verified: false },
    { id: 'sc-memory', category: 'memory',
      description: 'The system remembers decisions and does not repeatedly make the same mistakes',
      triggerPhrase: 'N/A — ongoing', expectedBehavior: 'Regression memory, durable decisions, anti-repetition',
      verified: false },
  ];

  getAll(): SuccessCriterion[] {
    return [...this.criteria];
  }

  getByCategory(category: SuccessCriterion['category']): SuccessCriterion[] {
    return this.criteria.filter(c => c.category === category);
  }

  verify(id: string): void {
    const criterion = this.criteria.find(c => c.id === id);
    if (criterion) {
      criterion.verified = true;
      criterion.verifiedAt = Date.now();
    }
  }

  unverify(id: string): void {
    const criterion = this.criteria.find(c => c.id === id);
    if (criterion) {
      criterion.verified = false;
      criterion.verifiedAt = undefined;
    }
  }

  getStats() {
    return {
      total: this.criteria.length,
      verified: this.criteria.filter(c => c.verified).length,
      unverified: this.criteria.filter(c => !c.verified).length,
      passRate: Math.round((this.criteria.filter(c => c.verified).length / this.criteria.length) * 100),
    };
  }
}

/**
 * SystemReportGenerator — generates a comprehensive system report.
 *
 * Brings together all subsystems into one overview.
 * Section 97 rule 20: "Measure system performance, not just model intelligence."
 */
export class SystemReportGenerator {
  generate(params: {
    totalAgents: number;
    totalConstitutionRules: number;
    totalEvaluationCases: number;
    totalSchedules: number;
    totalWorkflows: number;
    successCriteriaMet: number;
    successCriteriaTotal: number;
  }): SystemReport {
    const score = Math.round(
      (params.successCriteriaMet / params.successCriteriaTotal) * 100
    );

    return {
      generatedAt: Date.now(),
      totalAgents: params.totalAgents,
      totalConstitutionRules: params.totalConstitutionRules,
      totalEvaluationCases: params.totalEvaluationCases,
      totalSchedules: params.totalSchedules,
      totalWorkflows: params.totalWorkflows,
      successCriteriaMet: params.successCriteriaMet,
      successCriteriaTotal: params.successCriteriaTotal,
      overallScore: score,
      phase: 'Phase 10 — Final Integration',
      status: score >= 80 ? 'operational' : score >= 50 ? 'degraded' : 'initializing',
    };
  }
}
