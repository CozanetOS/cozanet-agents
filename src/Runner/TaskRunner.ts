import { CommandWindow, LogEntry, RunStatus, RunKind, RunOptions, RunHandle, BrowserSession } from './types';
import { AgentRegistry } from '../AgentRegistry';
import { AgentTask } from '../types';
import { EventEmitter } from 'events';

/**
 * TaskRunner — the visible command window system for CozanetOS.
 *
 * When an agent runs a command, opens a browser, or executes a task, the
 * TaskRunner creates a "command window" — a visual panel that shows:
 *   - Real-time stdout/stderr output
 *   - Status (queued → running → done/failed)
 *   - Browser activity (URL changes, clicks, typed inputs, screenshots)
 *   - Auto-dismissal when the task completes
 *
 * Key design principles:
 *   1. VISIBLE BY DEFAULT — if a user is watching the app, they see what's happening
 *   2. BACKGROUND CAPABLE — if no one's watching, everything still runs server-side
 *   3. AUTO-DISMISS — windows disappear after completion (configurable delay)
 *   4. BROWSER VISIBILITY — browser sessions can be shown live or run headless
 *   5. CANCELLABLE — any running task can be cancelled mid-flight
 *
 * Integration points: cozanet-automation (for scheduled runs), cozanet-browser
 * (for visible browser sessions), cozanet-communication (for real-time UI streaming).
 */
export class TaskRunner extends EventEmitter {
  private windows: Map<string, CommandWindow> = new Map();
  private cancelControllers: Map<string, { cancelled: boolean; timers: NodeJS.Timeout[] }> = new Map();
  private registry: AgentRegistry;
  private maxWindows: number;

  constructor(registry?: AgentRegistry, maxWindows = 50) {
    super();
    this.registry = registry || AgentRegistry.getInstance();
    this.maxWindows = maxWindows;
  }

  // ── Run a Command ──────────────────────────────────────────────────
  public runCommand(
    command: string,
    options?: RunOptions
  ): RunHandle {
    const windowId = this.createWindow('command', `cmd: ${command}`, options);
    const handle = this.createHandle(windowId);

    // Execute in background
    const promise = this.executeCommand(windowId, command, options);

    return { ...handle, promise };
  }

  // ── Run an Agent Task (visible) ────────────────────────────────────
  public runAgentTask(
    agentId: string,
    taskType: string,
    input: any,
    options?: RunOptions
  ): RunHandle {
    const title = `${agentId} → ${taskType}`;
    const windowId = this.createWindow('agent_task', title, {
      ...options,
      visible: options?.visible ?? true,
    });
    (this.windows.get(windowId) as any).agentId = agentId;
    (this.windows.get(windowId) as any).taskType = taskType;

    const handle = this.createHandle(windowId);

    const task: AgentTask = {
      id: windowId,
      agentId,
      type: taskType,
      input,
      status: 'pending',
      priority: 'normal',
      createdAt: Date.now(),
      retries: 0,
      maxRetries: 3,
      timeoutMs: options?.timeoutMs,
    };

    const promise = this.executeAgentTask(windowId, task, options);
    return { ...handle, promise };
  }

  // ── Open a Visible Browser Session ────────────────────────────────
  public openBrowser(
    url: string,
    options?: RunOptions & { headless?: boolean }
  ): RunHandle {
    const headless = options?.headless ?? false; // visible by default!
    const windowId = this.createWindow('browser', `browser: ${url}`, {
      ...options,
      visible: !headless && (options?.visible ?? true),
    });

    const session: BrowserSession = {
      id: `session:${Date.now()}`,
      url,
      visible: !headless,
      screenshots: [],
      clicks: [],
      typedInputs: [],
      currentUrl: url,
      status: 'navigating',
    };

    (this.windows.get(windowId) as any).browserSession = session;
    const handle = this.createHandle(windowId);

    const promise = this.executeBrowserSession(windowId, session, options);
    return { ...handle, promise };
  }

  // ── Run a Workflow (visible) ──────────────────────────────────────
  public runWorkflow(
    workflowId: string,
    options?: RunOptions
  ): RunHandle {
    const windowId = this.createWindow('workflow', `workflow: ${workflowId}`, options);
    const handle = this.createHandle(windowId);

    // Delegate to WorkflowAgent
    const promise = this.executeAgentTask(windowId, {
      id: windowId,
      agentId: 'agent:workflow',
      type: 'execute',
      input: { workflowId },
      status: 'pending',
      priority: 'normal',
      createdAt: Date.now(),
      retries: 0,
      maxRetries: 3,
    }, options);

    return { ...handle, promise };
  }

  // ── Run an API Call (visible) ─────────────────────────────────────
  public runApiCall(
    integrationId: string,
    endpoint: string,
    method: string,
    body?: any,
    options?: RunOptions
  ): RunHandle {
    const windowId = this.createWindow('api_call', `${method.toUpperCase()} ${endpoint}`, options);
    const handle = this.createHandle(windowId);

    const promise = this.executeAgentTask(windowId, {
      id: windowId,
      agentId: 'agent:integration',
      type: 'call',
      input: { integrationId, endpoint, method, body },
      status: 'pending',
      priority: 'normal',
      createdAt: Date.now(),
      retries: 0,
      maxRetries: 3,
    }, options);

    return { ...handle, promise };
  }

  // ── Window Management ─────────────────────────────────────────────

  /**
   * Get all currently visible windows — these are what the UI should render.
   * Windows that are done + auto-dismissed are excluded.
   */
  public getVisibleWindows(): CommandWindow[] {
    return Array.from(this.windows.values()).filter(w => w.visible);
  }

  /**
   * Get ALL windows including background ones (for admin/debug views).
   */
  public getAllWindows(): CommandWindow[] {
    return Array.from(this.windows.values());
  }

  public getWindow(id: string): CommandWindow | null {
    return this.windows.get(id) || null;
  }

  public getActiveCount(): number {
    return Array.from(this.windows.values()).filter(w => w.status === 'running' || w.status === 'queued').length;
  }

  /**
   * Manually dismiss a window (e.g., user clicks "X").
   */
  public dismissWindow(id: string): void {
    const w = this.windows.get(id);
    if (!w) return;
    w.visible = false;
    this.emit('window:dismissed', w);
    this.cleanupWindow(id);
  }

  /**
   * Cancel a running task.
   */
  public cancelTask(id: string): void {
    const ctrl = this.cancelControllers.get(id);
    if (ctrl) ctrl.cancelled = true;
    const w = this.windows.get(id);
    if (w && (w.status === 'running' || w.status === 'queued')) {
      w.status = 'cancelled';
      w.finishedAt = Date.now();
      this.appendLog(id, 'warn', 'Task cancelled by user.');
      this.emit('window:status', w);
      this.scheduleDismiss(id);
    }
  }

  // ── Internal: Window Creation ─────────────────────────────────────

  private createWindow(kind: RunKind, title: string, options?: RunOptions): string {
    const id = `win:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`;

    const win: CommandWindow = {
      id,
      kind,
      title,
      status: 'queued',
      startedAt: Date.now(),
      output: [],
      visible: options?.backgroundOnly ? false : (options?.visible ?? true),
      autoDismiss: options?.autoDismiss ?? true,
      dismissAfterMs: options?.dismissAfterMs ?? 3000,
      metadata: {},
    };

    // Enforce max windows — evict oldest done windows first
    if (this.windows.size >= this.maxWindows) {
      this.evictOldestDone();
    }

    this.windows.set(id, win);
    this.cancelControllers.set(id, { cancelled: false, timers: [] });

    this.emit('window:created', win);
    return id;
  }

  private createHandle(windowId: string): Omit<RunHandle, 'promise'> {
    return {
      windowId,
      cancel: () => this.cancelTask(windowId),
      getWindow: () => this.getWindow(windowId),
      appendLog: (level, message, source) => this.appendLog(windowId, level, message, source),
    };
  }

  // ── Internal: Execution ───────────────────────────────────────────

  private async executeCommand(windowId: string, command: string, options?: RunOptions): Promise<any> {
    const win = this.windows.get(windowId);
    if (!win) return;

    this.setStatus(windowId, 'running');
    this.appendLog(windowId, 'info', `$ ${command}`);

    try {
      // Integration point: route to cozanet-automation command executor
      // For now, simulate command execution with status updates
      this.appendLog(windowId, 'stdout', `Executing: ${command}`, 'runner');

      // Check for cancellation
      if (this.isCancelled(windowId)) {
        return null;
      }

      // Simulate command output streaming
      await new Promise(resolve => setTimeout(resolve, 100));

      this.appendLog(windowId, 'success', 'Command completed.', 'runner');
      this.setStatus(windowId, 'done');
      this.finishWindow(windowId, options);
      return { command, exitCode: 0 };
    } catch (err: any) {
      this.appendLog(windowId, 'error', err.message, 'runner');
      this.setStatus(windowId, 'failed');
      this.finishWindow(windowId, options);
      throw err;
    }
  }

  private async executeAgentTask(windowId: string, task: AgentTask, options?: RunOptions): Promise<any> {
    const win = this.windows.get(windowId);
    if (!win) return;

    this.setStatus(windowId, 'running');
    this.appendLog(windowId, 'info', `→ ${task.agentId}.${task.type}`, 'runner');

    try {
      const agent = this.registry.get(task.agentId);
      if (!agent) {
        throw new Error(`Agent ${task.agentId} not found`);
      }

      this.appendLog(windowId, 'info', `Agent found: ${agent.name}`, 'runner');

      if (this.isCancelled(windowId)) return null;

      const result = await agent.executeTask(task);

      this.appendLog(windowId, 'success', `Task completed in ${Date.now() - win.startedAt}ms`, 'runner');
      this.setStatus(windowId, 'done');
      this.finishWindow(windowId, options);
      return result;
    } catch (err: any) {
      this.appendLog(windowId, 'error', err.message, 'runner');
      this.setStatus(windowId, 'failed');
      this.finishWindow(windowId, options);
      throw err;
    }
  }

  private async executeBrowserSession(windowId: string, session: BrowserSession, options?: RunOptions): Promise<any> {
    const win = this.windows.get(windowId);
    if (!win) return;

    this.setStatus(windowId, 'running');

    if (session.visible) {
      this.appendLog(windowId, 'info', `🌐 Opening browser: ${session.url}`, 'browser');
    } else {
      this.appendLog(windowId, 'info', `🌐 Opening headless browser: ${session.url}`, 'browser');
    }

    try {
      // Integration point: route to BrowserAgent / cozanet-browser engine
      // The browser session is visible in the app if session.visible === true
      // If no one is watching, it runs headless but still records all activity

      if (this.isCancelled(windowId)) return null;

      // Delegate to BrowserAgent for actual navigation
      const browserAgent = this.registry.get('agent:browser');
      if (browserAgent) {
        this.appendLog(windowId, 'info', 'Navigating...', 'browser');
        const navResult = await browserAgent.executeTask({
          id: `nav:${windowId}`,
          agentId: 'agent:browser',
          type: 'navigate',
          input: { url: session.url },
          status: 'pending',
          priority: 'normal',
          createdAt: Date.now(),
          retries: 0,
          maxRetries: 2,
        });

        session.currentUrl = session.url;
        session.status = 'interactive';
        this.appendLog(windowId, 'success', `Page loaded: ${navResult?.title || session.url}`, 'browser');
      }

      // Return the session handle — the UI can use this to show live browser
      this.setStatus(windowId, 'done');
      this.finishWindow(windowId, options);
      return { session, screenshots: session.screenshots };
    } catch (err: any) {
      session.status = 'closed';
      this.appendLog(windowId, 'error', err.message, 'browser');
      this.setStatus(windowId, 'failed');
      this.finishWindow(windowId, options);
      throw err;
    }
  }

  // ── Browser Session Helpers (for agents to report activity) ──────

  /**
   * Record a browser click — called by BrowserAgent when clicking elements.
   * This makes clicks visible in the command window in real-time.
   */
  public recordBrowserClick(windowId: string, selector: string, success: boolean): void {
    const win = this.windows.get(windowId);
    if (!win?.browserSession) return;
    win.browserSession.clicks.push({ timestamp: Date.now(), selector, success });
    this.appendLog(windowId, 'info', `🖱️ Click: ${selector} ${success ? '✓' : '✗'}`, 'browser');
  }

  /**
   * Record typed input — called by BrowserAgent when typing into fields.
   */
  public recordBrowserType(windowId: string, selector: string, text: string): void {
    const win = this.windows.get(windowId);
    if (!win?.browserSession) return;
    win.browserSession.typedInputs.push({ timestamp: Date.now(), selector, text });
    this.appendLog(windowId, 'info', `⌨️ Type: "${text}" → ${selector}`, 'browser');
  }

  /**
   * Record a screenshot — called by BrowserAgent when capturing the page.
   */
  public recordBrowserScreenshot(windowId: string, path: string): void {
    const win = this.windows.get(windowId);
    if (!win?.browserSession) return;
    win.browserSession.screenshots.push({ timestamp: Date.now(), path });
    this.appendLog(windowId, 'info', `📸 Screenshot saved`, 'browser');
  }

  /**
   * Update the browser's current URL (navigation within the page).
   */
  public recordBrowserNavigation(windowId: string, url: string): void {
    const win = this.windows.get(windowId);
    if (!win?.browserSession) return;
    win.browserSession.currentUrl = url;
    this.appendLog(windowId, 'info', `🔗 Navigated to: ${url}`, 'browser');
  }

  // ── Internal: Status & Logging ───────────────────────────────────

  private setStatus(windowId: string, status: RunStatus): void {
    const win = this.windows.get(windowId);
    if (!win) return;
    win.status = status;
    this.emit('window:status', win);
  }

  private appendLog(windowId: string, level: LogEntry['level'], message: string, source?: string): void {
    const win = this.windows.get(windowId);
    if (!win) return;
    const entry: LogEntry = { timestamp: Date.now(), level, message, source };
    win.output.push(entry);
    this.emit('window:log', { windowId, entry });
  }

  private finishWindow(windowId: string, options?: RunOptions): void {
    const win = this.windows.get(windowId);
    if (!win) return;
    win.finishedAt = Date.now();

    if (options?.onComplete) options.onComplete(win);
    if (options?.onStatusChange) options.onStatusChange(win);

    // Auto-dismiss after configured delay
    if (win.autoDismiss) {
      this.scheduleDismiss(windowId);
    }
  }

  private scheduleDismiss(windowId: string): void {
    const win = this.windows.get(windowId);
    if (!win) return;
    const delay = win.dismissAfterMs ?? 3000;

    const timer = setTimeout(() => {
      this.dismissWindow(windowId);
    }, delay);

    const ctrl = this.cancelControllers.get(windowId);
    if (ctrl) ctrl.timers.push(timer);
  }

  private isCancelled(windowId: string): boolean {
    return this.cancelControllers.get(windowId)?.cancelled ?? false;
  }

  private cleanupWindow(windowId: string): void {
    const ctrl = this.cancelControllers.get(windowId);
    if (ctrl) {
      for (const t of ctrl.timers) clearTimeout(t);
    }
    // Don't delete immediately — keep for history, evict later via maxWindows
  }

  private evictOldestDone(): void {
    const done = Array.from(this.windows.entries())
      .filter(([_, w]) => w.status === 'done' || w.status === 'failed' || w.status === 'cancelled')
      .sort((a, b) => (a[1].finishedAt || 0) - (b[1].finishedAt || 0));

    if (done.length > 0) {
      const [oldestId] = done[0];
      this.windows.delete(oldestId);
      this.cancelControllers.delete(oldestId);
    }
  }

  // ── Stats ──────────────────────────────────────────────────────────
  public getStats(): { total: number; active: number; done: number; failed: number; visible: number } {
    const all = Array.from(this.windows.values());
    return {
      total: all.length,
      active: all.filter(w => w.status === 'running' || w.status === 'queued').length,
      done: all.filter(w => w.status === 'done').length,
      failed: all.filter(w => w.status === 'failed').length,
      visible: all.filter(w => w.visible).length,
    };
  }
}
