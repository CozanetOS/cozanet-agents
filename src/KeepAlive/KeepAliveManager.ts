import { AgentRegistry } from '../AgentRegistry';
import { BaseAgent } from '../base/BaseAgent';
import { AgentTask, TaskResult } from '../types';
import { CheckpointStore } from './TaskCheckpoint';
import { TaskCheckpoint, HeartbeatResponse, KeepAliveConfig } from './types';

/**
 * KeepAliveManager — the core of CozanetOS's survival strategy on
 * serverless platforms (Vercel free plan).
 *
 * HOW IT WORKS:
 *
 * 1. Agent tasks that might take >10s are submitted via `submitResumable()`
 * 2. The manager runs the task for a time-boxed slice (default 8s)
 * 3. If the task isn't done, it checkpoints state and pauses
 * 4. An external ping (cron-job.org / UptimeRobot / QStash) hits the heartbeat endpoint
 * 5. The heartbeat calls `resumeNext()`, which picks up the checkpoint and continues
 * 6. This repeats until the task completes or maxResumes is hit
 *
 * The key insight: we don't need the process to stay alive. We need the
 * STATE to survive and a TRIGGER to resume. This decouples "thinking time"
 * from "process lifetime."
 *
 * SETUP:
 *  - Create a free Upstash Redis instance for checkpoint storage
 *  - Set up cron-job.org or UptimeRobot to ping /api/heartbeat every 1-2 min
 *  - Or use Upstash QStash to self-schedule the next ping after each slice
 */
export class KeepAliveManager {
  private store: CheckpointStore;
  private config: KeepAliveConfig;
  private static instance: KeepAliveManager | null = null;

  static getInstance(config?: KeepAliveConfig): KeepAliveManager {
    if (!KeepAliveManager.instance) {
      KeepAliveManager.instance = new KeepAliveManager(
        config ?? {
          maxSliceMs: 8000, // 8s — leaves buffer under Vercel's 10s limit
          storage: (process.env.UPSTASH_REDIS_URL ? 'kv' : 'memory'),
          kvUrl: process.env.UPSTASH_REDIS_URL,
          kvToken: process.env.UPSTASH_REDIS_TOKEN,
          qstashUrl: process.env.QSTASH_URL,
          qstashToken: process.env.QSTASH_TOKEN,
          defaultPingDelayMs: 60000, // 1 min between pings
        }
      );
    }
    return KeepAliveManager.instance;
  }

  constructor(config: KeepAliveConfig) {
    this.config = config;
    this.store = new CheckpointStore(config);
  }

  /**
   * Submit a task that can survive serverless cold starts.
   * Returns a checkpoint ID immediately — the task continues across pings.
   */
  async submitResumable(task: AgentTask): Promise<{ checkpointId: string }> {
    const checkpoint: TaskCheckpoint = {
      id: `ckpt:${task.id}:${Date.now()}`,
      taskId: task.id,
      agentId: task.agentId,
      taskType: task.type,
      input: task.input,
      partialOutput: null,
      stepIndex: 0,
      status: 'pending',
      lastCheckpointAt: Date.now(),
      resumeCount: 0,
      maxResumes: task.maxRetries ? task.maxRetries * 5 : 50, // generous resume budget
      lastError: null,
      agentState: {},
    };

    await this.store.save(checkpoint);

    // Try to run the first slice right now
    await this.runSlice(checkpoint.id);

    return { checkpointId: checkpoint.id };
  }

  /**
   * Resume the next paused checkpoint. Called by the heartbeat endpoint.
   * This is the function that gets pinged externally.
   */
  async resumeNext(): Promise<HeartbeatResponse> {
    const paused = await this.store.getPaused();

    if (paused.length === 0) {
      return {
        hadWork: false,
        checkpointId: null,
        completed: false,
        needsAnotherPing: false,
        nextPingDelayMs: this.config.defaultPingDelayMs,
        pendingCount: 0,
        timestamp: Date.now(),
      };
    }

    // Resume the oldest paused checkpoint
    const checkpoint = paused.sort((a, b) => a.lastCheckpointAt - b.lastCheckpointAt)[0];
    await this.runSlice(checkpoint.id);

    // Re-read after the slice
    const updated = await this.store.load(checkpoint.id);

    const completed = updated?.status === 'completed';
    const stillPaused = updated?.status === 'paused';

    // If still paused, schedule next ping via QStash (if configured)
    if (stillPaused && this.config.qstashUrl) {
      await this.scheduleNextPing();
    }

    return {
      hadWork: true,
      checkpointId: checkpoint.id,
      completed,
      needsAnotherPing: stillPaused ?? false,
      nextPingDelayMs: this.config.defaultPingDelayMs,
      pendingCount: paused.length - (completed ? 1 : 0),
      timestamp: Date.now(),
    };
  }

  /**
   * Run a single time-boxed slice of a checkpointed task.
   * Enforces maxSliceMs — checkpoints and pauses if time runs out.
   */
  private async runSlice(checkpointId: string): Promise<void> {
    const checkpoint = await this.store.load(checkpointId);
    if (!checkpoint) return;
    if (checkpoint.status === 'completed' || checkpoint.status === 'failed') return;
    if (checkpoint.resumeCount >= checkpoint.maxResumes) {
      checkpoint.status = 'failed';
      checkpoint.lastError = `Exceeded max resume attempts (${checkpoint.maxResumes})`;
      await this.store.save(checkpoint);
      return;
    }

    checkpoint.status = 'running';
    checkpoint.resumeCount++;
    checkpoint.lastCheckpointAt = Date.now();
    await this.store.save(checkpoint);

    // Get the agent
    const registry = AgentRegistry.getInstance();
    const agent = registry.get(checkpoint.agentId);
    if (!agent) {
      checkpoint.status = 'failed';
      checkpoint.lastError = `Agent ${checkpoint.agentId} not registered`;
      await this.store.save(checkpoint);
      return;
    }

    // Reconstruct the task
    const task: AgentTask = {
      id: checkpoint.taskId,
      agentId: checkpoint.agentId,
      type: checkpoint.taskType,
      input: checkpoint.input,
      status: 'running',
      priority: 'normal',
      createdAt: checkpoint.lastCheckpointAt,
      retries: checkpoint.resumeCount,
      maxRetries: checkpoint.maxResumes,
      // Pass checkpoint state so the agent can resume
      checkpointState: checkpoint.agentState,
      partialOutput: checkpoint.partialOutput,
      stepIndex: checkpoint.stepIndex,
    } as AgentTask;

    // Race the task against the timeout
    const timeout = this.config.maxSliceMs;
    const deadline = Date.now() + timeout;

    try {
      const result = await Promise.race([
        agent.executeTask(task),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('SLICE_TIMEOUT')), timeout)
        ),
      ]);

      // Task completed within the slice!
      checkpoint.status = 'completed';
      checkpoint.partialOutput = result;
      checkpoint.lastCheckpointAt = Date.now();
      await this.store.save(checkpoint);
    } catch (err: any) {
      if (err.message === 'SLICE_TIMEOUT') {
        // Time-box expired — checkpoint whatever the agent left in the task
        checkpoint.status = 'paused';
        checkpoint.partialOutput = (task as any).partialOutput ?? checkpoint.partialOutput;
        checkpoint.agentState = (task as any).checkpointState ?? checkpoint.agentState;
        checkpoint.stepIndex = (task as any).stepIndex ?? checkpoint.stepIndex;
        checkpoint.lastCheckpointAt = Date.now();
        checkpoint.lastError = null; // timeout isn't an error
        await this.store.save(checkpoint);
      } else {
        // Real error
        checkpoint.status = 'failed';
        checkpoint.lastError = err.message;
        checkpoint.lastCheckpointAt = Date.now();
        await this.store.save(checkpoint);
      }
    }
  }

  /**
   * Get status of a checkpoint (for polling from the client).
   */
  async getStatus(checkpointId: string): Promise<TaskCheckpoint | null> {
    return this.store.load(checkpointId);
  }

  /**
   * Cancel a checkpointed task.
   */
  async cancel(checkpointId: string): Promise<void> {
    const cp = await this.store.load(checkpointId);
    if (cp) {
      cp.status = 'failed';
      cp.lastError = 'Cancelled by user';
      await this.store.save(cp);
    }
  }

  /**
   * Schedule the next ping via Upstash QStash (self-scheduling).
   * This is the "ping without me re-prompting" mechanism.
   */
  private async scheduleNextPing(): Promise<void> {
    if (!this.config.qstashUrl || !this.config.qstashToken) return;

    const heartbeatUrl = process.env.HEARTBEAT_URL;
    if (!heartbeatUrl) {
      console.warn('[KeepAlive] HEARTBEAT_URL not set — cannot self-schedule ping via QStash');
      return;
    }

    try {
      // QStash endpoint: POST https://qstash.upstash.io/v1/publish/{url}
      // with delay header to schedule it for later
      await fetch(`${this.config.qstashUrl}/publish/${encodeURIComponent(heartbeatUrl)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.qstashToken}`,
          'Content-Type': 'application/json',
          'Delay': `${this.config.defaultPingDelayMs}s`, // QStash uses seconds
        },
        body: JSON.stringify({ source: 'keepalive', timestamp: Date.now() }),
      });
    } catch (err) {
      console.warn('[KeepAlive] QStash scheduling failed:', err);
      // Fallback: external cron (cron-job.org / UptimeRobot) will still ping
    }
  }
}
