import { AgentTask, AgentMessage, AgentStatus, AgentCapability, AgentEvent, EventHandler } from '../types';

/**
 * BaseAgent — abstract foundation for all CozanetOS agents.
 *
 * v0.2.0 upgrades:
 *  - Lifecycle hooks (onStart, onStop, onPause, onResume, onError)
 *  - Capability declaration
 *  - Event emission
 *  - Heartbeat / health tracking
 *  - Message routing with reply support
 *  - Graceful error handling with retry awareness
 */
export abstract class BaseAgent {
  public id: string;
  public name: string;
  public role: string;

  protected status: AgentStatus = 'idle';
  protected capabilities: AgentCapability[] = [];
  protected handlers: EventHandler[] = [];
  protected messageHandlers: ((msg: AgentMessage) => void)[] = [];

  protected startedAt: number | null = null;
  protected lastActiveAt: number = 0;
  protected tasksCompleted = 0;
  protected tasksFailed = 0;
  protected lastError: string | null = null;

  constructor(id: string, name: string, role: string) {
    this.id = id;
    this.name = name;
    this.role = role;
  }

  // ── Abstract ────────────────────────────────────────────────────────
  public abstract handle(task: AgentTask): Promise<any>;

  // ── Lifecycle ──────────────────────────────────────────────────────
  public start(): void {
    this.status = 'running';
    this.startedAt = Date.now();
    this.lastActiveAt = Date.now();
    this.onStart();
    this.emit({ type: 'agent:started', agentId: this.id, timestamp: Date.now() });
  }

  public stop(): void {
    this.status = 'idle';
    this.startedAt = null;
    this.onStop();
    this.emit({ type: 'agent:stopped', agentId: this.id, timestamp: Date.now() });
  }

  public pause(): void {
    if (this.status === 'running') {
      this.status = 'paused';
    }
  }

  public resume(): void {
    if (this.status === 'paused') {
      this.status = 'running';
      this.lastActiveAt = Date.now();
    }
  }

  public terminate(): void {
    this.status = 'terminated';
    this.startedAt = null;
  }

  // ── Lifecycle Hooks (override in subclasses) ────────────────────────
  protected onStart(): void {}
  protected onStop(): void {}
  protected onPause(): void {}
  protected onResume(): void {}
  protected onError(error: string): void {
    this.lastError = error;
  }

  // ── Capabilities ───────────────────────────────────────────────────
  public getCapabilities(): AgentCapability[] {
    return this.capabilities;
  }

  protected registerCapability(cap: AgentCapability): void {
    this.capabilities.push(cap);
  }

  public supportsTaskType(type: string): boolean {
    return this.capabilities.some(c => c.taskTypes.includes(type));
  }

  // ── Messaging ──────────────────────────────────────────────────────
  public sendMessage(to: string, payload: any, type: string = 'direct', replyTo?: string): AgentMessage {
    const msg: AgentMessage = {
      id: `msg:${this.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      from: this.id,
      to,
      type,
      payload,
      timestamp: Date.now(),
      replyTo,
    };
    this.emit({ type: 'message:sent', message: msg });
    return msg;
  }

  public onMessage(handler: (msg: AgentMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  public receiveMessage(msg: AgentMessage): void {
    this.lastActiveAt = Date.now();
    this.emit({ type: 'message:received', message: msg });
    for (const handler of this.messageHandlers) {
      try {
        handler(msg);
      } catch (err: any) {
        this.reportError(`Message handler error: ${err.message}`);
      }
    }
  }

  // ── Task Execution with Retry & Error Tracking ─────────────────────
  public async executeTask(task: AgentTask): Promise<any> {
    this.lastActiveAt = Date.now();
    task.startedAt = Date.now();
    task.status = 'running';

    try {
      const result = await this.handle(task);
      task.status = 'done';
      task.output = result;
      task.completedAt = Date.now();
      this.tasksCompleted++;
      this.emit({
        type: 'task:completed',
        taskId: task.id,
        agentId: this.id,
        durationMs: (task.completedAt - task.startedAt) || 0,
        timestamp: Date.now(),
      });
      return result;
    } catch (err: any) {
      task.status = 'failed';
      task.retries++;
      this.tasksFailed++;
      this.reportError(err.message);
      this.emit({
        type: 'task:failed',
        taskId: task.id,
        agentId: this.id,
        error: err.message,
        timestamp: Date.now(),
      });
      throw err;
    }
  }

  // ── Health & Status ────────────────────────────────────────────────
  public getStatus(): AgentStatus {
    return this.status;
  }

  public getUptime(): number {
    if (!this.startedAt) return 0;
    return Date.now() - this.startedAt;
  }

  public isHealthy(): boolean {
    return this.status === 'running' && this.lastError === null;
  }

  public getStats() {
    return {
      tasksCompleted: this.tasksCompleted,
      tasksFailed: this.tasksFailed,
      uptime: this.getUptime(),
      lastActiveAt: this.lastActiveAt,
      lastError: this.lastError,
    };
  }

  protected reportError(error: string): void {
    this.lastError = error;
    this.onError(error);
    this.emit({ type: 'agent:error', agentId: this.id, error, timestamp: Date.now() });
  }

  // ── Events ─────────────────────────────────────────────────────────
  public on(eventHandler: EventHandler): void {
    this.handlers.push(eventHandler);
  }

  protected emit(event: AgentEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch {
        // Swallow event handler errors — they shouldn't crash the agent
      }
    }
  }
}
