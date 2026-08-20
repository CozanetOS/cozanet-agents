// ── Phase 10 — Final Integration types ───────────────────────────────

export interface OperatingRule {
  number: number;
  rule: string;
  category: 'memory' | 'process' | 'security' | 'architecture' | 'autonomy' | 'quality';
}

export interface SuccessCriterion {
  id: string;
  category: 'personal' | 'engineering' | 'company' | 'research' | 'automation' | 'execution' | 'verification' | 'memory';
  description: string;
  triggerPhrase: string;
  expectedBehavior: string;
  verified: boolean;
  verifiedAt?: number;
}

export interface SystemReport {
  generatedAt: number;
  totalAgents: number;
  totalConstitutionRules: number;
  totalEvaluationCases: number;
  totalSchedules: number;
  totalWorkflows: number;
  successCriteriaMet: number;
  successCriteriaTotal: number;
  overallScore: number;          // 0-100
  phase: string;
  status: 'operational' | 'degraded' | 'initializing';
}
