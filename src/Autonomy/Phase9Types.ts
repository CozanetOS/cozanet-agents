// ── Phase 9 — Advanced Autonomy types ──────────────────────────────

// Section 83: Long-running tasks
export type LongTaskStatus =
  | 'planning' | 'in_progress' | 'paused' | 'completed' | 'failed' | 'cancelled';

export type AutonomyLevel = 1 | 2 | 3;

// Task state for long-running tasks
export interface TaskState {
  gitState: string;
  taskState: string;
}


export interface LongRunningTask {
  id: string;
  objective: string;
  milestones: Milestone[];
  status: LongTaskStatus;
  startedAt: number;
  completedAt?: number;
  currentMilestone: number;
  progress: number;          // 0-100
  state: TaskState;
  checkpoints: Checkpoint[];
  evidence: string[];
  nextAction: string;
  autonomyLevel: AutonomyLevel;
  metadata?: Record<string, any>;
}

export interface Milestone {
  index: number;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  completedAt?: number;
  evidence?: string;
}

// Section 50: Progress checkpoint
export interface Checkpoint {
  id: string;
  whatWasTrueBefore: string;
  whatChanged: string;
  whatIsTrueNow: string;
  whatRemains: string;
  whatIsBlocked: string;
  nextAction: string;
  timestamp: number;
}

// Section 49: Failure recovery
export interface FailureRecoveryState {
  taskId: string;
  gitState: string;
  taskState: string;
  lastKnownGoodState: string;
  inspectionResults: string[];
  recoveryActions: string[];
  recovered: boolean;
  timestamp: number;
}

// PR preparation (Level 2)
export interface PRPreparation {
  id: string;
  title: string;
  branch: string;
  baseBranch: string;
  description: string;
  filesChanged: string[];
  commits: string[];
  acceptanceCriteria: string[];
  status: 'draft' | 'ready' | 'submitted' | 'merged' | 'rejected';
  createdAt: number;
  submittedAt?: number;
}

// Continuous company intelligence
export interface IntelligenceFeed {
  id: string;
  source: string;
  category: string;
  content: string;
  relevance: number;          // 0-100
  timestamp: number;
  acknowledged: boolean;
}
