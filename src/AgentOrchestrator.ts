import { AgentRegistry } from './AgentRegistry';
import { BaseAgent } from './base/BaseAgent';
import { AgentTask, Agent, TaskResult, TaskPriority, AgentEvent, EventHandler } from './types';
import { TaskRunner } from './Runner/TaskRunner';
import { RunOptions, CommandWindow, RunHandle } from './Runner/types';

// Core agents
import { CEOAgent } from './CEO/CEOAgent';
import { ResearchAgent } from './Research/ResearchAgent';
import { CodingAgent } from './Coding/CodingAgent';
import { MemoryAgent } from './Memory/MemoryAgent';
import { PlannerAgent } from './Planner/PlannerAgent';

// Extended agents
import { LearningAgent } from './Learning/LearningAgent';
import { KnowledgeAgent } from './Knowledge/KnowledgeAgent';
import { BrowserAgent } from './Browser/BrowserAgent';
import { ReviewAgent } from './Review/ReviewAgent';
import { TestingAgent } from './Testing/TestingAgent';
import { SecurityAgent } from './Security/SecurityAgent';
import { VisionAgent } from './Vision/VisionAgent';
import { CX7Agent } from './CX7/CX7Agent';
import { DeviceAgent } from './Device/DeviceAgent';
import { APIAgent } from './API/APIAgent';
import { WorkflowAgent } from './Workflow/WorkflowAgent';
import { SchedulerAgent } from './Scheduler/SchedulerAgent';
import { EmailAgent } from './Email/EmailAgent';
import { DocumentsAgent } from './Documents/DocumentsAgent';
import { VoiceAgent } from './Voice/VoiceAgent';
import { AnalyticsAgent } from './Analytics/AnalyticsAgent';
import { DatabaseAgent } from './Database/DatabaseAgent';
import { IntegrationAgent } from './Integration/IntegrationAgent';

// Automation & worker system
import { AutomationAgent } from './Automation/AutomationAgent';

// Phase 3 — GitHub Engine
import { GitHubAgent } from './GitHub/GitHubAgent';

/**
 * AgentOrchestrator — central coordinator for all CozanetOS agents.
 *
 * v0.2.0 upgrades:
 *  - Registers all 23 core agents (including AutomationAgent — the "worker")
 *  - Task queue with priority
 *  - Parallel task execution
 *  - Timeout handling
 *  - Retry logic with exponential backoff
 *  - Event observation
 *  - Health monitoring
 *  - TaskRunner integration — every task gets a visible command window
 *    that shows real-time output and auto-dismisses when done
 */
export class AgentOrchestrator {
  private registry = AgentRegistry.getInstance();
  private taskQueue: AgentTask[] = [];
  private running = false;
  private eventHandlers: EventHandler[] = [];

  /** TaskRunner — manages visible command windows for all running tasks */
  public runner: TaskRunner;

  constructor() {
    this.runner = new TaskRunner(this.registry);
  }

  // ── Initialization ──────────────────────────────────────────────────
  public async initialize(): Promise<void> {
    const allAgents: BaseAgent[] = [
      // Core
      new CEOAgent(),
      new ResearchAgent(),
      new CodingAgent(),
      new MemoryAgent(),
      new PlannerAgent(),
      // Extended
      new LearningAgent(),
      new KnowledgeAgent(),
      new BrowserAgent(),
      new ReviewAgent(),
      new TestingAgent(),
      new SecurityAgent(),
      new VisionAgent(),
      new CX7Agent(),
      new DeviceAgent(),
      new APIAgent(),
      new WorkflowAgent(),
      new SchedulerAgent(),
      new EmailAgent(),
      new DocumentsAgent(),
      new VoiceAgent(),
      new AnalyticsAgent(),
      new DatabaseAgent(),
      new IntegrationAgent(),
      // Automation & worker
      new AutomationAgent(),
      // Phase 3 — GitHub Engine
      new GitHubAgent(),
    ];

    for (const agent of allAgents) {
      this.registry.register(agent);
      agent.on((event) => this.forwardEvent(event));
      agent.start();
    }

    this.running = true;
  }

  // ── Task Submission ────────────────────────────────────────────────

  /**
   * Submit a task. By default, a visible command window is created showing
   * real-time output. The window auto-dismisses when the task completes.
   *
   * Pass `visible: false` in options to run silently in the background.
   */
  public async submitTask(
    task: AgentTask,
    options?: { visible?: boolean; autoDismiss?: boolean; dismissAfterMs?: number }
  ): Promise<TaskResult> {
    const startTime = Date.now();

    const agent = this.registry.get(task.agentId);
    if (!agent) {
      return {
        taskId: task.id,
        agentId: task.agentId,
        status: 'failed',
        error: `Target Agent ${task.agentId} is not registered.`,
        durationMs: 0,
      };
    }

    // Create a visible window for this task (unless explicitly hidden)
    const runOptions: RunOptions = {
      visible: options?.visible ?? true,
      autoDismiss: options?.autoDismiss ?? true,
      dismissAfterMs: options?.dismissAfterMs ?? 3000,
    };

    const handle = this.runner.runAgentTask(task.agentId, task.type, task.input, runOptions);

    try {
      const output = await handle.promise;
      return {
        taskId: task.id,
        agentId: task.agentId,
        status: 'done',
        output,
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        taskId: task.id,
        agentId: task.agentId,
        status: 'failed',
        error: err.message,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Submit a task silently — no visible window, pure background execution.
   * The task still runs and completes, but nothing shows in the UI.
   */
  public async submitBackground(task: AgentTask): Promise<TaskResult> {
    return this.submitTask(task, { visible: false, autoDismiss: false });
  }

  public enqueueTask(task: AgentTask): void {
    this.taskQueue.push(task);
    const priorityOrder: Record<TaskPriority, number> = { critical: 0, high: 1, normal: 2, low: 3 };
    this.taskQueue.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  public async processQueue(maxConcurrent = 5): Promise<TaskResult[]> {
    const results: TaskResult[] = [];
    const batch: Promise<TaskResult>[] = [];

    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift()!;
      batch.push(this.submitTask(task));

      if (batch.length >= maxConcurrent) {
        results.push(...await Promise.all(batch));
        batch.length = 0;
      }
    }

    if (batch.length > 0) {
      results.push(...await Promise.all(batch));
    }

    return results;
  }

  // ── Visible Browser ────────────────────────────────────────────────

  /**
   * Open a visible browser session. Shows in the app — you can watch the
   * agent navigate, click, and type in real-time. If no one's watching,
   * it falls back to headless mode but still records all activity.
   *
   * The browser window auto-dismisses when the session is done.
   */
  public openVisibleBrowser(url: string, options?: { headless?: boolean; autoDismiss?: boolean }): RunHandle {
    return this.runner.openBrowser(url, {
      headless: options?.headless ?? false,
      autoDismiss: options?.autoDismiss ?? false, // keep browser visible by default
    });
  }

  // ── Visible Command ─────────────────────────────────────────────────

  /**
   * Run a shell command with a visible terminal window.
   * Shows real-time stdout/stderr, auto-dismisses when done.
   */
  public runVisibleCommand(command: string, options?: { autoDismiss?: boolean; dismissAfterMs?: number }): RunHandle {
    return this.runner.runCommand(command, {
      visible: true,
      autoDismiss: options?.autoDismiss ?? true,
      dismissAfterMs: options?.dismissAfterMs ?? 3000,
    });
  }

  // ── Execution with Retry & Timeout ─────────────────────────────────
  private async executeWithRetry(agent: BaseAgent, task: AgentTask): Promise<any> {
    let lastError: Error | null = null;
    const maxRetries = task.maxRetries ?? 3;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (task.timeoutMs) {
          return await this.executeWithTimeout(agent, task);
        }
        return await agent.executeTask(task);
      } catch (err: any) {
        lastError = err;
        task.retries = attempt;
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 100;
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    throw lastError;
  }

  private async executeWithTimeout(agent: BaseAgent, task: AgentTask): Promise<any> {
    return Promise.race([
      agent.executeTask(task),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          task.status = 'timeout';
          reject(new Error(`Task ${task.id} timed out after ${task.timeoutMs}ms`));
        }, task.timeoutMs);
      }),
    ]);
  }

  // ── Delegation ──────────────────────────────────────────────────────
  public async delegate(task: AgentTask): Promise<any> {
    const agent = this.registry.get(task.agentId);
    if (!agent) {
      throw new Error(`Agent ${task.agentId} not found.`);
    }
    return agent.executeTask(task);
  }

  // ── Visible Windows ─────────────────────────────────────────────────

  /**
   * Get all currently visible command windows.
   * The UI should render these as floating terminal panels.
   */
  public getVisibleWindows(): CommandWindow[] {
    return this.runner.getVisibleWindows();
  }

  /**
   * Get all windows (including background ones).
   */
  public getAllWindows(): CommandWindow[] {
    return this.runner.getAllWindows();
  }

  /**
   * Get TaskRunner stats — how many windows are active, done, failed.
   */
  public getRunnerStats() {
    return this.runner.getStats();
  }

  // ── Status & Health ────────────────────────────────────────────────
  public getAgentStatus(id: string): Agent {
    const agent = this.registry.get(id);
    if (!agent) {
      throw new Error(`Agent ${id} not found.`);
    }
    const stats = agent.getStats();
    return {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      status: agent.getStatus(),
      capabilities: agent.getCapabilities(),
      uptime: stats.uptime,
      lastActive: stats.lastActiveAt,
      tasksCompleted: stats.tasksCompleted,
      tasksFailed: stats.tasksFailed,
    };
  }

  public getAllAgentStatuses(): Agent[] {
    return this.registry.list().map(a => {
      const stats = a.getStats();
      return {
        id: a.id,
        name: a.name,
        role: a.role,
        status: a.getStatus(),
        capabilities: a.getCapabilities(),
        uptime: stats.uptime,
        lastActive: stats.lastActiveAt,
        tasksCompleted: stats.tasksCompleted,
        tasksFailed: stats.tasksFailed,
      };
    });
  }

  public getHealthReport() {
    return this.registry.getHealthAll();
  }

  // ── Events ─────────────────────────────────────────────────────────
  public onEvent(handler: EventHandler): void {
    this.eventHandlers.push(handler);
  }

  /**
   * Subscribe to TaskRunner window events.
   * Events: 'window:created', 'window:status', 'window:log', 'window:dismissed'
   */
  public onWindowEvent(handler: (event: string, window: any) => void): void {
    this.runner.on('window:created', (w) => handler('window:created', w));
    this.runner.on('window:status', (w) => handler('window:status', w));
    this.runner.on('window:log', (w) => handler('window:log', w));
    this.runner.on('window:dismissed', (w) => handler('window:dismissed', w));
  }

  private forwardEvent(event: AgentEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // Swallow
      }
    }
  }

  // ── Shutdown ───────────────────────────────────────────────────────
  public async shutdown(): Promise<void> {
    for (const agent of this.registry.list()) {
      agent.stop();
    }
    this.running = false;
  }
}
