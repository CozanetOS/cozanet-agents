// ── Phase 8 — Remote Engineering types (Section 46) ─────────────────

export type WorkflowStatus = 'not_run' | 'in_progress' | 'success' | 'failure' | 'cancelled';

export interface GitHubActionsWorkflow {
  id: string;
  name: string;
  filename: string;          // .github/workflows/*.yml
  trigger: WorkflowTrigger;
  jobs: WorkflowJob[];
  status: WorkflowStatus;
  lastRun?: number;
  lastRunUrl?: string;
}

export type WorkflowTrigger =
  | { kind: 'push'; branches: string[] }
  | { kind: 'pull_request'; branches: string[] }
  | { kind: 'schedule'; cron: string }
  | { kind: 'workflow_dispatch'; inputs?: Record<string, any> }
  | { kind: 'on_release' };

export interface WorkflowJob {
  id: string;
  name: string;
  runsOn: 'ubuntu-latest' | 'ubuntu-22.04' | 'self-hosted';
  steps: WorkflowStep[];
  needs?: string[];
}

export interface WorkflowStep {
  name: string;
  action?: string;          // uses: actions/checkout@v4
  run?: string;             // shell command
  with?: Record<string, any>;
  if?: string;
}

// ── Remote build ────────────────────────────────────────────────────

export interface RemoteBuild {
  id: string;
  repo: string;
  branch: string;
  commitSha: string;
  status: 'queued' | 'running' | 'success' | 'failed';
  logs?: string[];
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  triggeredBy: string;
}

// ── Deployment monitoring ───────────────────────────────────────────

export type DeploymentStatus = 'deployed' | 'building' | 'error' | 'ready' | 'queued';

export interface DeploymentInfo {
  id: string;
  project: string;
  url: string;
  status: DeploymentStatus;
  branch: string;
  commitSha: string;
  createdAt: number;
  updatedAt: number;
  errorMessage?: string;
  aliases?: string[];
}

export interface HealthCheck {
  url: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTimeMs?: number;
  statusCode?: number;
  lastChecked: number;
  errorMessage?: string;
}
