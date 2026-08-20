// ── Phase 7 — Evaluation types (Section 36, 72, 87) ────────────────

export type EvaluationStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

export interface EvaluationCase {
  id: string;
  name: string;
  category: EvaluationCategory;
  description: string;
  prompt: string;
  expectedBehavior: string;
  weight: number;            // 1-10 — importance of this evaluation
  status: EvaluationStatus;
  lastRun?: number;
  lastResult?: EvaluationResult;
}

export type EvaluationCategory =
  | 'architecture'
  | 'security'
  | 'aegis'
  | 'research'
  | 'engineering'
  | 'memory'
  | 'recovery'
  | 'opportunities'
  | 'permissions'
  | 'self_improvement';

export interface EvaluationResult {
  caseId: string;
  passed: boolean;
  score: number;             // 0-100
  actualBehavior: string;
  notes: string;
  durationMs: number;
  timestamp: number;
}

export interface EvaluationRun {
  id: string;
  totalCases: number;
  passed: number;
  failed: number;
  skipped: number;
  score: number;             // 0-100 weighted
  results: EvaluationResult[];
  startedAt: number;
  completedAt: number;
  durationMs: number;
}

// ── Regression memory (Section 87) ──────────────────────────────────

export interface RegressionEntry {
  id: string;
  problem: string;
  cause: string;
  fix: string;
  lesson: string;
  regressionTest: string;
  createdAt: number;
  lastVerified?: number;
  verifiedCount: number;
}

// ── Agent performance tracking ──────────────────────────────────────

export interface AgentPerformance {
  agentId: string;
  agentName: string;
  tasksHandled: number;
  tasksSucceeded: number;
  tasksFailed: number;
  avgDurationMs: number;
  lastTaskAt?: number;
  failureRate: number;       // 0-100
  successRate: number;       // 0-100
  history: PerformanceEntry[];
}

export interface PerformanceEntry {
  taskType: string;
  status: 'success' | 'failed' | 'partial';
  durationMs: number;
  timestamp: number;
  error?: string;
}

// ── Self-improvement (Section 72) ───────────────────────────────────

export interface SelfImprovementTask {
  id: string;
  description: string;
  weakness: string;
  evidence: string[];
  status: 'identified' | 'analyzed' | 'in_progress' | 'resolved' | 'deferred';
  createdAt: number;
  resolvedAt?: number;
  resolution?: string;
}
