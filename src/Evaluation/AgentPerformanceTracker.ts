import { AgentPerformance, PerformanceEntry, SelfImprovementTask } from './Phase7Types';

/**
 * AgentPerformanceTracker — tracks how each agent performs over time.
 *
 * Records task handling, success/failure rates, and duration metrics.
 * Used to identify which agents need improvement and detect patterns.
 *
 * Section 97 rule 17: "Learn from failures."
 * Section 97 rule 20: "Measure system performance, not just model intelligence."
 */
export class AgentPerformanceTracker {
  private performances: Map<string, AgentPerformance> = new Map();

  // ── Record a task result ──────────────────────────────────────────
  recordTask(
    agentId: string,
    agentName: string,
    taskType: string,
    status: 'success' | 'failed' | 'partial',
    durationMs: number,
    error?: string,
  ): void {
    let perf = this.performances.get(agentId);
    if (!perf) {
      perf = {
        agentId, agentName,
        tasksHandled: 0, tasksSucceeded: 0, tasksFailed: 0,
        avgDurationMs: 0, failureRate: 0, successRate: 0,
        history: [],
      };
      this.performances.set(agentId, perf);
    }

    perf.tasksHandled++;
    if (status === 'success') perf.tasksSucceeded++;
    else if (status === 'failed') perf.tasksFailed++;

    perf.lastTaskAt = Date.now();

    // Update average duration
    perf.avgDurationMs = Math.round(
      ((perf.avgDurationMs * (perf.tasksHandled - 1)) + durationMs) / perf.tasksHandled
    );

    // Update rates
    perf.successRate = Math.round((perf.tasksSucceeded / perf.tasksHandled) * 100);
    perf.failureRate = Math.round((perf.tasksFailed / perf.tasksHandled) * 100);

    // Add to history (cap at 100)
    const entry: PerformanceEntry = { taskType, status, durationMs, timestamp: Date.now(), error };
    perf.history.push(entry);
    if (perf.history.length > 100) perf.history.shift();
  }

  // ── Get performance ───────────────────────────────────────────────
  getPerformance(agentId: string): AgentPerformance | null {
    return this.performances.get(agentId) ?? null;
  }

  getAllPerformances(): AgentPerformance[] {
    return Array.from(this.performances.values()).sort((a, b) => b.tasksHandled - a.tasksHandled);
  }

  // ── Get weakest agents (highest failure rate) ─────────────────────
  getWeakestAgents(limit: number = 5): AgentPerformance[] {
    return this.getAllPerformances()
      .filter(p => p.tasksHandled >= 3)  // need at least 3 tasks
      .sort((a, b) => b.failureRate - a.failureRate)
      .slice(0, limit);
  }

  // ── Get strongest agents ──────────────────────────────────────────
  getStrongestAgents(limit: number = 5): AgentPerformance[] {
    return this.getAllPerformances()
      .filter(p => p.tasksHandled >= 3)
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, limit);
  }

  // ── Get recent failures ───────────────────────────────────────────
  getRecentFailures(limit: number = 10): PerformanceEntry[] {
    const failures: PerformanceEntry[] = [];
    for (const perf of this.performances.values()) {
      failures.push(...perf.history.filter(h => h.status === 'failed'));
    }
    return failures.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }

  // ── Stats ─────────────────────────────────────────────────────────
  getStats() {
    const all = Array.from(this.performances.values());
    const totalTasks = all.reduce((s, p) => s + p.tasksHandled, 0);
    const totalSucceeded = all.reduce((s, p) => s + p.tasksSucceeded, 0);
    const totalFailed = all.reduce((s, p) => s + p.tasksFailed, 0);
    return {
      agentsTracked: all.length,
      totalTasks,
      totalSucceeded,
      totalFailed,
      overallSuccessRate: totalTasks > 0 ? Math.round((totalSucceeded / totalTasks) * 100) : 0,
      overallFailureRate: totalTasks > 0 ? Math.round((totalFailed / totalTasks) * 100) : 0,
    };
  }
}

/**
 * SelfImprovement — Section 72: "The system should detect weaknesses
 * in its own harness and create self-improvement tasks."
 *
 * Example: "I repeatedly fail to diagnose Vercel issues because deployment
 * logs are unavailable." → Create: "SELF-IMPROVEMENT TASK: Add deployment-log integration."
 */
export class SelfImprovement {
  private tasks: Map<string, SelfImprovementTask> = new Map();

  // ── Detect weaknesses from performance data ───────────────────────
  detectWeaknesses(tracker: AgentPerformanceTracker): SelfImprovementTask[] {
    const weakest = tracker.getWeakestAgents(5);
    const recentFailures = tracker.getRecentFailures(20);
    const detected: SelfImprovementTask[] = [];

    // Pattern: agent with high failure rate
    for (const agent of weakest) {
      if (agent.failureRate >= 30) {
        const task = this.create(
          `Improve ${agent.agentName} reliability (failure rate: ${agent.failureRate}%)`,
          `${agent.agentName} has a ${agent.failureRate}% failure rate across ${agent.tasksHandled} tasks`,
          agent.history.filter(h => h.status === 'failed').map(h => `${h.taskType}: ${h.error ?? 'unknown error'}`),
        );
        detected.push(task);
      }
    }

    // Pattern: repeated failures in the same task type
    const taskTypeFailures: Record<string, number> = {};
    for (const f of recentFailures) {
      taskTypeFailures[f.taskType] = (taskTypeFailures[f.taskType] ?? 0) + 1;
    }
    for (const [taskType, count] of Object.entries(taskTypeFailures)) {
      if (count >= 3) {
        const task = this.create(
          `Investigate repeated failures in task type: ${taskType}`,
          `Task type "${taskType}" has failed ${count} times in recent history`,
          recentFailures.filter(f => f.taskType === taskType).map(f => f.error ?? 'no error message'),
        );
        detected.push(task);
      }
    }

    return detected;
  }

  // ── Create a self-improvement task ────────────────────────────────
  create(
    description: string,
    weakness: string,
    evidence: string[],
  ): SelfImprovementTask {
    const task: SelfImprovementTask = {
      id: `self:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
      description, weakness, evidence,
      status: 'identified',
      createdAt: Date.now(),
    };
    this.tasks.set(task.id, task);
    return task;
  }

  // ── Update status ─────────────────────────────────────────────────
  update(id: string, status: SelfImprovementTask['status'], resolution?: string): void {
    const task = this.tasks.get(id);
    if (task) {
      task.status = status;
      if (resolution) {
        task.resolution = resolution;
        task.resolvedAt = Date.now();
      }
    }
  }

  // ── Query ─────────────────────────────────────────────────────────
  getTasks(filter?: { status?: string }): SelfImprovementTask[] {
    let results = Array.from(this.tasks.values());
    if (filter?.status) results = results.filter(t => t.status === filter.status);
    return results.sort((a, b) => b.createdAt - a.createdAt);
  }

  getStats() {
    const all = Array.from(this.tasks.values());
    return {
      total: all.length,
      identified: all.filter(t => t.status === 'identified').length,
      inProgress: all.filter(t => t.status === 'in_progress').length,
      resolved: all.filter(t => t.status === 'resolved').length,
      deferred: all.filter(t => t.status === 'deferred').length,
    };
  }
}
