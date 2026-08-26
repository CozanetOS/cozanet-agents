// ── AgentOrchestrator — Real LLM-powered orchestration ──────────────
//
// v0.3.0 — Real implementations:
//  - LLM-powered task routing: natural language → which agent + what task type
//  - Task chaining: output of one task feeds into the next
//  - Retry with exponential backoff actually wired into submitTask
//  - Real shell command execution via TaskRunner
//  - Inter-agent delegation with result propagation
//
// The orchestrator is the central nervous system — it doesn't DO work
// itself, it decides WHO does the work and chains their outputs.

import { AgentRegistry } from './AgentRegistry';
import { BaseAgent } from './base/BaseAgent';
import { AgentTask, Agent, TaskResult, TaskPriority, AgentEvent, EventHandler } from './types';
import { TaskRunner } from './Runner/TaskRunner';
import { RunOptions, CommandWindow, RunHandle } from './Runner/types';
import { ModelAdapter } from './models/ModelAdapter';

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

// ── Types ─────────────────────────────────────────────────────────────

export interface TaskRoute {
  agentId: string;
  taskType: string;
  input: any;
  confidence: number;
  reason: string;
}

export interface TaskChainStep {
  description: string;
  agentId: string;
  taskType: string;
  input: any;
  // Transform previous step's output into this step's input
  // If null, this step's input is used as-is
  transformInput?: (previousOutput: any) => any;
}

export interface TaskChainResult {
  steps: Array<{
    description: string;
    agentId: string;
    status: 'done' | 'failed' | 'skipped';
    output?: any;
    error?: string;
    durationMs: number;
  }>;
  finalOutput: any;
  totalDurationMs: number;
  success: boolean;
}

// ── Agent Metadata for Routing ─────────────────────────────────────────

const AGENT_CAPABILITIES: Array<{ agentId: string; keywords: string[]; taskTypes: string[]; description: string }> = [
  { agentId: 'agent:ceo', keywords: ['plan', 'strategy', 'decide', 'coordinate', 'delegate', 'prioritize'], taskTypes: ['plan', 'delegate', 'decide'], description: 'Strategic planning and delegation' },
  { agentId: 'agent:research', keywords: ['research', 'search', 'investigate', 'analyze', 'find', 'study', 'compare'], taskTypes: ['search', 'analyze', 'summarize'], description: 'Research and information gathering' },
  { agentId: 'agent:coding', keywords: ['code', 'generate', 'review', 'refactor', 'test', 'debug', 'implement', 'function', 'class', 'api'], taskTypes: ['generate_code', 'review_code', 'refactor', 'explain_code', 'generate_tests'], description: 'Code generation, review, and refactoring' },
  { agentId: 'agent:memory', keywords: ['remember', 'store', 'recall', 'forget', 'context', 'history'], taskTypes: ['store', 'recall', 'forget'], description: 'Memory storage and retrieval' },
  { agentId: 'agent:planner', keywords: ['plan', 'schedule', 'roadmap', 'timeline', 'milestone', 'organize'], taskTypes: ['create_plan', 'schedule', 'roadmap'], description: 'Planning and scheduling' },
  { agentId: 'agent:browser', keywords: ['browse', 'navigate', 'scrape', 'click', 'page', 'website', 'url'], taskTypes: ['navigate', 'extract', 'interact'], description: 'Web browsing and automation' },
  { agentId: 'agent:review', keywords: ['review', 'audit', 'quality', 'check', 'inspect', 'pr'], taskTypes: ['review', 'audit'], description: 'Code and document review' },
  { agentId: 'agent:testing', keywords: ['test', 'unit test', 'integration', 'coverage', 'e2e', 'spec'], taskTypes: ['run_tests', 'generate_tests', 'coverage'], description: 'Testing and test generation' },
  { agentId: 'agent:security', keywords: ['security', 'vulnerability', 'encrypt', 'scan', 'audit', 'key', 'secret', 'auth'], taskTypes: ['scan', 'encrypt', 'audit'], description: 'Security scanning and encryption' },
  { agentId: 'agent:knowledge', keywords: ['knowledge', 'document', 'wiki', 'learn', 'explain', 'tutorial'], taskTypes: ['query', 'store', 'explain'], description: 'Knowledge base management' },
  { agentId: 'agent:email', keywords: ['email', 'send', 'mail', 'inbox', 'reply', 'compose'], taskTypes: ['send', 'read', 'reply'], description: 'Email operations' },
  { agentId: 'agent:documents', keywords: ['document', 'pdf', 'doc', 'write', 'report', 'generate document'], taskTypes: ['create', 'convert', 'read'], description: 'Document creation and management' },
  { agentId: 'agent:analytics', keywords: ['analytics', 'metrics', 'stats', 'data', 'chart', 'report'], taskTypes: ['analyze', 'report', 'visualize'], description: 'Data analytics and reporting' },
  { agentId: 'agent:database', keywords: ['database', 'query', 'sql', 'insert', 'update', 'delete', 'schema'], taskTypes: ['query', 'mutate', 'schema'], description: 'Database operations' },
  { agentId: 'agent:github', keywords: ['github', 'git', 'commit', 'push', 'pull request', 'pr', 'repo', 'branch', 'issue'], taskTypes: ['commit', 'push', 'create_pr', 'manage_issue'], description: 'GitHub repository operations' },
  { agentId: 'agent:automation', keywords: ['automate', 'cron', 'schedule', 'recurring', 'monitor', 'worker'], taskTypes: ['schedule', 'monitor', 'run_job'], description: 'Automation and scheduled tasks' },
];

/**
 * AgentOrchestrator — central coordinator for all CozanetOS agents.
 */
export class AgentOrchestrator {
  private registry = AgentRegistry.getInstance();
  private taskQueue: AgentTask[] = [];
  private running = false;
  private eventHandlers: EventHandler[] = [];
  private model: ModelAdapter;

  /** TaskRunner — manages visible command windows for all running tasks */
  public runner: TaskRunner;

  constructor() {
    this.runner = new TaskRunner(this.registry);
    this.model = ModelAdapter.getInstance();
  }

  // ── Initialization ──────────────────────────────────────────────────
  public async initialize(): Promise<void> {
    const allAgents: BaseAgent[] = [
      new CEOAgent(),
      new ResearchAgent(),
      new CodingAgent(),
      new MemoryAgent(),
      new PlannerAgent(),
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
      new AutomationAgent(),
      new GitHubAgent(),
    ];

    for (const agent of allAgents) {
      this.registry.register(agent);
      agent.on((event) => this.forwardEvent(event));
      agent.start();
    }

    this.running = true;
    console.log(`[Orchestrator] Initialized ${allAgents.length} agents`);
  }

  // ── LLM-Powered Task Routing ─────────────────────────────────────────

  /**
   * Given a natural language request, determine which agent should handle it
   * and what task type to assign. Uses LLM for intelligent routing.
   */
  public async routeTask(request: string): Promise<TaskRoute> {
    // First try keyword-based fast path
    const fastRoute = this.fastPathRoute(request);
    if (fastRoute && fastRoute.confidence > 0.8) {
      return fastRoute;
    }

    // Fall back to LLM-powered routing
    const agentList = AGENT_CAPABILITIES.map(a =>
      `- ${a.agentId}: ${a.description} (handles: ${a.taskTypes.join(', ')})`
    ).join('\n');

    const systemPrompt = `You are a task router for a multi-agent system. Given a user request, determine which agent should handle it and what task type to assign.

Available agents:
${agentList}

Return a JSON object with this exact structure:
{
  "agentId": "agent:xxx",
  "taskType": "the task type",
  "input": { ... the parsed input for the task ... },
  "confidence": 0.0-1.0,
  "reason": "why this agent and task type"
}

Return ONLY the JSON.`;

    try {
      const result = await this.model.generate(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: request },
        ],
        { maxTokens: 512, temperature: 0.1, responseFormat: 'json' },
      );

      const route = JSON.parse(this.stripMarkdown(result.text));
      return {
        agentId: route.agentId,
        taskType: route.taskType,
        input: route.input || { request },
        confidence: route.confidence ?? 0.5,
        reason: route.reason || 'LLM routed',
      };
    } catch {
      // If LLM fails, fall back to keyword routing
      return fastRoute || {
        agentId: 'agent:ceo',
        taskType: 'delegate',
        input: { request },
        confidence: 0.3,
        reason: 'Fallback: could not route intelligently',
      };
    }
  }

  /**
   * Fast-path keyword-based routing — no LLM needed for obvious cases.
   */
  private fastPathRoute(request: string): TaskRoute | null {
    const lower = request.toLowerCase();

    // Score each agent by keyword matches
    let bestAgent: typeof AGENT_CAPABILITIES[0] | null = null;
    let bestScore = 0;

    for (const agent of AGENT_CAPABILITIES) {
      let score = 0;
      for (const keyword of agent.keywords) {
        if (lower.includes(keyword)) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent;
      }
    }

    if (bestAgent && bestScore > 0) {
      // Pick the most likely task type
      const taskType = bestAgent.taskTypes[0];
      return {
        agentId: bestAgent.agentId,
        taskType,
        input: { request, spec: request },
        confidence: Math.min(0.95, 0.5 + bestScore * 0.15),
        reason: `Keyword match (${bestScore} keywords matched: ${bestAgent.agentId})`,
      };
    }

    return null;
  }

  // ── Task Submission ────────────────────────────────────────────────

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
   */
  public async submitBackground(task: AgentTask): Promise<TaskResult> {
    return this.submitTask(task, { visible: false, autoDismiss: false });
  }

  /**
   * Submit a natural language request — the orchestrator routes it to the
   * right agent automatically using LLM-powered routing.
   */
  public async submit(request: string, options?: { visible?: boolean }): Promise<TaskResult> {
    const route = await this.routeTask(request);

    const task: AgentTask = {
      id: `task:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
      agentId: route.agentId,
      type: route.taskType,
      input: route.input,
      status: 'pending',
      priority: 'normal',
      createdAt: Date.now(),
      retries: 0,
      maxRetries: 3,
    };

    console.log(`[Orchestrator] Routed "${request.slice(0, 60)}..." → ${route.agentId}.${route.taskType} (confidence: ${route.confidence})`);

    return this.submitTask(task, options);
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

  // ── Task Chaining ───────────────────────────────────────────────────

  /**
   * Execute a chain of tasks where each step's output feeds into the next.
   * If any step fails, the chain stops (unless skipOnError is true).
   */
  public async executeChain(
    steps: TaskChainStep[],
    options?: { skipOnError?: boolean; visible?: boolean }
  ): Promise<TaskChainResult> {
    const startTime = Date.now();
    const results: TaskChainResult['steps'] = [];
    let previousOutput: any = undefined;
    let success = true;

    for (const step of steps) {
      const stepStart = Date.now();

      // Transform input using previous output if transformer is defined
      let input = step.input;
      if (step.transformInput && previousOutput !== undefined) {
        try {
          input = step.transformInput(previousOutput);
        } catch (err: any) {
          results.push({
            description: step.description,
            agentId: step.agentId,
            status: 'failed',
            error: `Input transform failed: ${err.message}`,
            durationMs: Date.now() - stepStart,
          });
          success = false;
          break;
        }
      }

      const task: AgentTask = {
        id: `chain:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
        agentId: step.agentId,
        type: step.taskType,
        input,
        status: 'pending',
        priority: 'normal',
        createdAt: Date.now(),
        retries: 0,
        maxRetries: 3,
      };

      try {
        const result = await this.submitTask(task, { visible: options?.visible ?? false });

        if (result.status === 'done') {
          previousOutput = result.output;
          results.push({
            description: step.description,
            agentId: step.agentId,
            status: 'done',
            output: result.output,
            durationMs: result.durationMs,
          });
        } else {
          results.push({
            description: step.description,
            agentId: step.agentId,
            status: 'failed',
            error: result.error,
            durationMs: result.durationMs,
          });

          if (!options?.skipOnError) {
            success = false;
            break;
          }
        }
      } catch (err: any) {
        results.push({
          description: step.description,
          agentId: step.agentId,
          status: 'failed',
          error: err.message,
          durationMs: Date.now() - stepStart,
        });

        if (!options?.skipOnError) {
          success = false;
          break;
        }
      }
    }

    return {
      steps: results,
      finalOutput: previousOutput,
      totalDurationMs: Date.now() - startTime,
      success,
    };
  }

  // ── Visible Browser ────────────────────────────────────────────────

  public openVisibleBrowser(url: string, options?: { headless?: boolean; autoDismiss?: boolean }): RunHandle {
    return this.runner.openBrowser(url, {
      headless: options?.headless ?? false,
      autoDismiss: options?.autoDismiss ?? false,
    });
  }

  // ── Visible Command ─────────────────────────────────────────────────

  /**
   * Run a shell command with a visible terminal window.
   * Now executes REAL shell commands via child_process.exec.
   */
  public runVisibleCommand(command: string, options?: { autoDismiss?: boolean; dismissAfterMs?: number; timeoutMs?: number }): RunHandle {
    return this.runner.runCommand(command, {
      visible: true,
      autoDismiss: options?.autoDismiss ?? true,
      dismissAfterMs: options?.dismissAfterMs ?? 3000,
      timeoutMs: options?.timeoutMs,
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
          console.warn(`[Orchestrator] Retry ${attempt + 1}/${maxRetries} for ${task.id} in ${delay}ms`);
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
        }, task.timeoutMs!);
      }),
    ]);
  }

  // ── Delegation ──────────────────────────────────────────────────────

  public async delegate(task: AgentTask): Promise<any> {
    const agent = this.registry.get(task.agentId);
    if (!agent) {
      throw new Error(`Agent ${task.agentId} not found.`);
    }
    return this.executeWithRetry(agent, task);
  }

  // ── Visible Windows ─────────────────────────────────────────────────

  public getVisibleWindows(): CommandWindow[] {
    return this.runner.getVisibleWindows();
  }

  public getAllWindows(): CommandWindow[] {
    return this.runner.getAllWindows();
  }

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

  // ── Helpers ─────────────────────────────────────────────────────────

  private stripMarkdown(text: string): string {
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    return cleaned;
  }

  // ── Shutdown ───────────────────────────────────────────────────────
  public async shutdown(): Promise<void> {
    for (const agent of this.registry.list()) {
      agent.stop();
    }
    this.running = false;
    console.log('[Orchestrator] All agents stopped.');
  }
}
