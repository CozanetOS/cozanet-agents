/**
 * KeepAlive Types — checkpoint and resume structures for surviving
 * Vercel serverless cold starts and timeout limits.
 *
 * Problem: Vercel free plan kills serverless functions after ~10s.
 * Solution: Break long agent tasks into time-boxed slices. After each
 * slice, checkpoint state. A heartbeat ping resumes from the checkpoint.
 * The ping is triggered externally (cron-job.org, UptimeRobot, or QStash).
 */

export type CheckpointStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed';

export interface TaskCheckpoint {
  /** Unique ID for this checkpoint */
  id: string;
  /** Original task ID from AgentTask */
  taskId: string;
  /** Which agent was running */
  agentId: string;
  /** Task type */
  taskType: string;
  /** Original input */
  input: any;
  /** Accumulated output so far */
  partialOutput: any;
  /** Which step we're on (for multi-step tasks) */
  stepIndex: number;
  /** Total steps (if known) */
  totalSteps?: number;
  /** Status */
  status: CheckpointStatus;
  /** Timestamp of last checkpoint */
  lastCheckpointAt: number;
  /** Number of resume attempts so far */
  resumeCount: number;
  /** Max resume attempts before giving up */
  maxResumes: number;
  /** Any error from the last attempt */
  lastError: string | null;
  /** Arbitrary state the agent wants to preserve */
  agentState: Record<string, any>;
}

export interface HeartbeatResponse {
  /** Whether there was work to do */
  hadWork: boolean;
  /** Checkpoint ID that was processed (if any) */
  checkpointId: string | null;
  /** Whether the task completed during this heartbeat */
  completed: boolean;
  /** Whether another heartbeat is needed */
  needsAnotherPing: boolean;
  /** Time to wait before next ping (ms) — for QStash scheduling */
  nextPingDelayMs: number;
  /** Active checkpoints count */
  pendingCount: number;
  /** Timestamp */
  timestamp: number;
}

export interface KeepAliveConfig {
  /** Max time per execution slice (ms). Leave buffer under Vercel's limit */
  maxSliceMs: number;
  /** Where to store checkpoints. 'memory' for dev, 'kv' for Upstash Redis */
  storage: 'memory' | 'kv';
  /** Upstash Redis URL (if storage = 'kv') */
  kvUrl?: string;
  /** Upstash Redis token (if storage = 'kv') */
  kvToken?: string;
  /** QStash URL for self-scheduling next ping (optional) */
  qstashUrl?: string;
  /** QStash token (optional) */
  qstashToken?: string;
  /** Default delay between pings (ms) */
  defaultPingDelayMs: number;
}
