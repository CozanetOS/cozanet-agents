import {
  LongRunningTask, Milestone, LongTaskStatus, AutonomyLevel,
  Checkpoint, FailureRecoveryState,
} from './Phase9Types';

/**
 * LongRunningTaskManager — Section 83: "Support work that cannot finish
 * in one session."
 *
 * Each task needs: objective, milestones, progress, state, checkpoints,
 * evidence, next action.
 *
 * "This prevents one-shot agent failure."
 *
 * Section 50: Progress Checkpoint — "What was true before? What changed?
 * What is true now? What remains? What is blocked? What is the next action?"
 *
 * Section 49: Failure Recovery — "inspect Git state, inspect task state,
 * inspect progress, inspect tests, identify last known good state, resume."
 */

export class LongRunningTaskManager {
  private tasks: Map<string, LongRunningTask> = new Map();

  // ── Create a long-running task ────────────────────────────────────
  create(
    objective: string,
    milestoneTitles: string[],
    autonomyLevel: AutonomyLevel = 1,
  ): LongRunningTask {
    const milestones: Milestone[] = milestoneTitles.map((title, i) => ({
      index: i,
      title,
      description: title,
      status: 'pending' as const,
    }));

    const task: LongRunningTask = {
      id: `task:long:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
      objective,
      milestones,
      status: 'planning',
      startedAt: Date.now(),
      currentMilestone: 0,
      progress: 0,
      state: { gitState: 'clean', taskState: 'initialized' },
      checkpoints: [],
      evidence: [],
      nextAction: milestoneTitles[0] ?? 'Start',
      autonomyLevel,
    };

    this.tasks.set(task.id, task);
    return task;
  }

  // ── Start a task ──────────────────────────────────────────────────
  start(taskId: string): LongRunningTask | null {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'in_progress';
      task.milestones[0].status = 'in_progress';
      this.createCheckpoint(taskId, {
        whatWasTrueBefore: 'Task not started',
        whatChanged: 'Task started',
        whatIsTrueNow: 'Task is in progress',
        whatRemains: task.milestones.filter(m => m.status !== 'completed').map(m => m.title).join('; '),
        whatIsBlocked: 'Nothing',
        nextAction: task.milestones[0].title,
      });
    }
    return task ?? null;
  }

  // ── Complete a milestone ──────────────────────────────────────────
  completeMilestone(taskId: string, milestoneIndex: number, evidence?: string): LongRunningTask | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    const milestone = task.milestones[milestoneIndex];
    if (!milestone) return null;

    milestone.status = 'completed';
    milestone.completedAt = Date.now();
    if (evidence) {
      milestone.evidence = evidence;
      task.evidence.push(`Milestone ${milestoneIndex}: ${evidence}`);
    }

    // Update progress
    const completed = task.milestones.filter(m => m.status === 'completed').length;
    task.progress = Math.round((completed / task.milestones.length) * 100);
    task.currentMilestone = completed;

    // Next milestone
    const nextMilestone = task.milestones.find(m => m.status === 'pending');
    task.nextAction = nextMilestone?.title ?? 'Task complete — all milestones done';

    // Check if all done
    if (completed === task.milestones.length) {
      task.status = 'completed';
      task.completedAt = Date.now();
    } else if (nextMilestone) {
      nextMilestone.status = 'in_progress';
    }

    return task;
  }

  // ── Create a checkpoint (Section 50) ──────────────────────────────
  createCheckpoint(taskId: string, data: Omit<Checkpoint, 'id' | 'timestamp'>): Checkpoint | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    const checkpoint: Checkpoint = {
      ...data,
      id: `ckpt:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    };

    task.checkpoints.push(checkpoint);
    task.nextAction = data.nextAction;
    return checkpoint;
  }

  // ── Pause a task ──────────────────────────────────────────────────
  pause(taskId: string, reason: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'paused';
      this.createCheckpoint(taskId, {
        whatWasTrueBefore: 'Task was in progress',
        whatChanged: `Task paused: ${reason}`,
        whatIsTrueNow: 'Task is paused',
        whatRemains: task.milestones.filter(m => m.status !== 'completed').map(m => m.title).join('; '),
        whatIsBlocked: reason,
        nextAction: 'Resume when blocker is resolved',
      });
    }
  }

  // ── Resume a task ─────────────────────────────────────────────────
  resume(taskId: string): LongRunningTask | null {
    const task = this.tasks.get(taskId);
    if (task && task.status === 'paused') {
      task.status = 'in_progress';
      this.createCheckpoint(taskId, {
        whatWasTrueBefore: 'Task was paused',
        whatChanged: 'Task resumed',
        whatIsTrueNow: 'Task is in progress',
        whatRemains: task.milestones.filter(m => m.status !== 'completed').map(m => m.title).join('; '),
        whatIsBlocked: 'Nothing',
        nextAction: task.milestones.find(m => m.status === 'in_progress')?.title ?? 'Continue',
      });
    }
    return task ?? null;
  }

  // ── Fail a task ───────────────────────────────────────────────────
  fail(taskId: string, reason: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'failed';
      this.createCheckpoint(taskId, {
        whatWasTrueBefore: 'Task was in progress',
        whatChanged: `Task failed: ${reason}`,
        whatIsTrueNow: 'Task has failed',
        whatRemains: task.milestones.filter(m => m.status !== 'completed').map(m => m.title).join('; '),
        whatIsBlocked: reason,
        nextAction: 'Run failure recovery',
      });
    }
  }

  // ── Failure recovery (Section 49) ─────────────────────────────────
  recoverFromFailure(taskId: string, gitState: string): FailureRecoveryState {
    const task = this.tasks.get(taskId);
    const inspections: string[] = [];

    // Step 1: inspect Git state
    inspections.push(`Git state: ${gitState}`);

    // Step 2: inspect task state
    inspections.push(`Task state: ${task?.status ?? 'unknown'}`);

    // Step 3: inspect progress
    if (task) {
      inspections.push(`Progress: ${task.progress}% (${task.currentMilestone}/${task.milestones.length} milestones)`);
    }

    // Step 4: inspect tests
    inspections.push('Tests: pending verification');

    // Step 5: identify last known good state
    const lastGoodCheckpoint = task?.checkpoints.filter(c => !c.whatIsBlocked || c.whatIsBlocked === 'Nothing').pop();
    const lastGood = lastGoodCheckpoint
      ? `Checkpoint at ${new Date(lastGoodCheckpoint.timestamp).toISOString()}: ${lastGoodCheckpoint.whatIsTrueNow}`
      : 'No prior checkpoint — start from beginning';

    // Step 6: resume
    if (task) {
      task.status = 'in_progress';
      inspections.push('Resuming from last known good state');
    }

    const recoveryActions = [
      'Inspect Git state',
      'Inspect task state',
      'Inspect progress',
      'Inspect tests',
      'Identify last known good state',
      'Resume',
    ];

    return {
      taskId,
      gitState,
      taskState: task?.status ?? 'unknown',
      lastKnownGoodState: lastGood,
      inspectionResults: inspections,
      recoveryActions,
      recovered: true,
      timestamp: Date.now(),
    };
  }

  // ── Queries ───────────────────────────────────────────────────────
  getTasks(filter?: { status?: LongTaskStatus }): LongRunningTask[] {
    let results = Array.from(this.tasks.values());
    if (filter?.status) results = results.filter(t => t.status === filter.status);
    return results.sort((a, b) => b.startedAt - a.startedAt);
  }

  getTask(id: string): LongRunningTask | null {
    return this.tasks.get(id) ?? null;
  }

  getActiveTasks(): LongRunningTask[] {
    return this.getTasks({ status: 'in_progress' });
  }

  getPausedTasks(): LongRunningTask[] {
    return this.getTasks({ status: 'paused' });
  }

  // ── Stats ─────────────────────────────────────────────────────────
  getStats() {
    const all = Array.from(this.tasks.values());
    return {
      total: all.length,
      inProgress: all.filter(t => t.status === 'in_progress').length,
      paused: all.filter(t => t.status === 'paused').length,
      completed: all.filter(t => t.status === 'completed').length,
      failed: all.filter(t => t.status === 'failed').length,
      avgProgress: all.length > 0
        ? Math.round(all.reduce((s, t) => s + t.progress, 0) / all.length)
        : 0,
      totalCheckpoints: all.reduce((s, t) => s + t.checkpoints.length, 0),
    };
  }
}

// ── Export TaskState interface ──────────────────────────────────────
export interface TaskState {
  gitState: string;
  taskState: string;
}
