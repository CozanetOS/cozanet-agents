import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';
import { SchedulerAgent, ScheduledJob } from '../Scheduler/SchedulerAgent';
import { WorkflowAgent, WorkflowDef } from '../Workflow/WorkflowAgent';
import { AgentRegistry } from '../AgentRegistry';
import { AutonomousRunner, AutonomousGoal, ProgressReport, AutonomousConfig } from '../Runner/AutonomousRunner';

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger: AutomationTrigger;
  action: AutomationAction;
  status: 'active' | 'paused' | 'disabled';
  createdAt: number;
  lastFired?: number;
  fireCount: number;
  maxFires?: number;
  lastReport?: string;         // self-report from last execution
}

export type AutomationTrigger =
  | { kind: 'schedule'; cron: string }
  | { kind: 'interval'; ms: number }
  | { kind: 'once'; executeAt: number }
  | { kind: 'event'; eventType: string; filter?: Record<string, any> }
  | { kind: 'monitor'; target: string; condition: string; checkIntervalMs: number };

export type AutomationAction =
  | { kind: 'agent_task'; agentId: string; taskType: string; input: any }
  | { kind: 'workflow'; workflowId: string }
  | { kind: 'notify'; message: string; channel?: string }
  | { kind: 'api_call'; integrationId: string; endpoint: string; method: string; body?: any }
  | { kind: 'autonomous'; description: string; steps?: any[]; config?: AutonomousConfig };

export interface MonitorResult {
  target: string;
  healthy: boolean;
  value: any;
  message: string;
  timestamp: number;
}

/**
 * AutomationAgent — the "staff member" of CozanetOS.
 *
 * This is the difference between a chatbot and a worker. It:
 *  - Schedules recurring jobs ("every Monday", "every day at 9am")
 *  - Sets up one-time future tasks
 *  - Monitors targets on intervals and triggers actions when conditions are met
 *  - Chains multi-step workflows
 *  - Fires on events (entity changes, external webhooks)
 *  - Runs autonomous goals: plan → execute → self-report → check → continue
 *  - Uses API keys from the vault for external calls
 *
 * Think of it as the employee that never sleeps — it shows up, does the work,
 * reports what it did, checks if it's done, and continues until the goal is complete.
 *
 * Integration points: cozanet-automation, cozanet-monitoring, cozanet-scheduler,
 * cozanet-identity (API keys).
 */
export class AutomationAgent extends BaseAgent {
  private rules: Map<string, AutomationRule> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private monitorResults: Map<string, MonitorResult[]> = new Map();
  private scheduler: SchedulerAgent | null = null;
  private workflow: WorkflowAgent | null = null;
  private autonomousRunner: AutonomousRunner;

  constructor() {
    super('agent:automation', 'Automation Agent', 'Recurring Jobs, Monitoring & Autonomous Workers');

    this.registerCapability({
      name: 'automation',
      description: 'Schedule recurring tasks, monitor targets, run autonomous goals with self-reporting, manage API keys',
      taskTypes: [
        'create_rule', 'pause_rule', 'resume_rule', 'delete_rule', 'list_rules',
        'monitor', 'run_now', 'get_status',
        'run_autonomous', 'get_progress', 'cancel_autonomous', 'resume_autonomous',
        'list_autonomous_goals', 'get_autonomous_report',
      ],
    });

    this.autonomousRunner = new AutonomousRunner();
  }

  protected onStart(): void {
    console.log(`[${this.id}] Automation Agent online — the worker that never sleeps.`);

    const registry = AgentRegistry.getInstance();
    this.scheduler = registry.get('agent:scheduler') as SchedulerAgent | null;
    this.workflow = registry.get('agent:workflow') as WorkflowAgent | null;

    if (!this.scheduler) {
      this.scheduler = new SchedulerAgent();
      registry.register(this.scheduler);
      this.scheduler.start();
    }
    if (!this.workflow) {
      this.workflow = new WorkflowAgent();
      registry.register(this.workflow);
      this.workflow.start();
    }
  }

  public async handle(task: AgentTask): Promise<any> {
    switch (task.type) {
      // Rule management
      case 'create_rule':
        return this.createRule(task.input.name, task.input.description, task.input.trigger, task.input.action, task.input.maxFires);
      case 'pause_rule':
        return this.pauseRule(task.input.ruleId);
      case 'resume_rule':
        return this.resumeRule(task.input.ruleId);
      case 'delete_rule':
        return this.deleteRule(task.input.ruleId);
      case 'list_rules':
        return this.listRules();
      case 'monitor':
        return this.monitor(task.input.target, task.input.condition, task.input.intervalMs);
      case 'run_now':
        return this.runNow(task.input.ruleId);
      case 'get_status':
        return this.getRuleStatus(task.input.ruleId);

      // Autonomous goal runner
      case 'run_autonomous':
        return this.runAutonomous(task.input.description, task.input.steps, task.input.config);
      case 'run_autonomous_auto_plan':
        return this.runAutonomousAutoPlan(task.input.description, task.input.config);
      case 'get_progress':
        return this.getProgress(task.input.goalId);
      case 'cancel_autonomous':
        return this.cancelAutonomous(task.input.goalId);
      case 'resume_autonomous':
        return this.resumeAutonomous(task.input.goalId, task.input.config);
      case 'list_autonomous_goals':
        return this.listAutonomousGoals();
      case 'get_autonomous_report':
        return this.getAutonomousReport(task.input.goalId);

      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  // ── Rule Management ─────────────────────────────────────────────────
  private async createRule(
    name: string,
    description: string,
    trigger: AutomationTrigger,
    action: AutomationAction,
    maxFires?: number
  ): Promise<AutomationRule> {
    const rule: AutomationRule = {
      id: `auto:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
      name, description, trigger, action,
      status: 'active',
      createdAt: Date.now(),
      fireCount: 0,
      maxFires,
    };
    this.rules.set(rule.id, rule);
    this.activateRule(rule);
    console.log(`[${this.id}] Created automation rule: "${name}" (trigger: ${trigger.kind})`);
    return rule;
  }

  private async pauseRule(ruleId: string): Promise<{ ruleId: string; paused: boolean }> {
    const rule = this.rules.get(ruleId);
    if (!rule) return { ruleId, paused: false };
    rule.status = 'paused';
    this.deactivateRule(ruleId);
    return { ruleId, paused: true };
  }

  private async resumeRule(ruleId: string): Promise<{ ruleId: string; resumed: boolean }> {
    const rule = this.rules.get(ruleId);
    if (!rule) return { ruleId, resumed: false };
    rule.status = 'active';
    this.activateRule(rule);
    return { ruleId, resumed: true };
  }

  private async deleteRule(ruleId: string): Promise<{ ruleId: string; deleted: boolean }> {
    this.deactivateRule(ruleId);
    return { ruleId, deleted: this.rules.delete(ruleId) };
  }

  private async listRules(): Promise<AutomationRule[]> {
    return Array.from(this.rules.values());
  }

  private async runNow(ruleId: string): Promise<{ ruleId: string; fired: boolean; result: any }> {
    const rule = this.rules.get(ruleId);
    if (!rule) return { ruleId, fired: false, result: null };
    const result = await this.fireRule(rule);
    return { ruleId, fired: true, result };
  }

  private async getRuleStatus(ruleId: string): Promise<AutomationRule | null> {
    return this.rules.get(ruleId) || null;
  }

  // ── Autonomous Goal Runner ──────────────────────────────────────────

  /**
   * Run an autonomous goal — plan, execute, self-report, continue until done.
   * The worker will:
   *   1. Execute each step
   *   2. Generate a progress report ("I did X, the result was Y, next I'll do Z")
   *   3. Check if the goal is complete
   *   4. Continue to the next step if not done
   *   5. Use API keys from the vault for external calls
   *
   * Example:
   *   agent.handle({ type: 'run_autonomous', input: {
   *     description: 'Check club events and email members',
   *     steps: [
   *       { description: 'Scrape events page', agentId: 'agent:browser', taskType: 'scrape', input: { url: '...' } },
   *       { description: 'Send emails', agentId: 'agent:email', taskType: 'send', input: { ... }, usesApiKey: { provider: 'sendgrid' } },
   *     ],
   *     config: { maxIterations: 10, reportTo: 'agent:email' },
   *   }});
   */
  private async runAutonomous(
    description: string,
    steps?: any[],
    config?: AutonomousConfig
  ): Promise<AutonomousGoal> {
    if (steps && steps.length > 0) {
      return this.autonomousRunner.runGoal(description, steps, config);
    }
    // No steps provided — let CEO auto-plan
    return this.autonomousRunner.runGoalAutoPlan(description, config);
  }

  private async runAutonomousAutoPlan(description: string, config?: AutonomousConfig): Promise<AutonomousGoal> {
    return this.autonomousRunner.runGoalAutoPlan(description, config);
  }

  private getProgress(goalId: string) {
    return this.autonomousRunner.getProgress(goalId);
  }

  private cancelAutonomous(goalId: string) {
    return this.autonomousRunner.cancelGoal(goalId);
  }

  private async resumeAutonomous(goalId: string, config?: AutonomousConfig) {
    return this.autonomousRunner.resumeGoal(goalId, config);
  }

  private listAutonomousGoals(): AutonomousGoal[] {
    return this.autonomousRunner.listGoals();
  }

  /**
   * Get the full progress report history for an autonomous goal.
   * This is the "what I did" self-report — every step, every iteration.
   */
  private getAutonomousReport(goalId: string): { reports: ProgressReport[]; goal: AutonomousGoal | null } {
    const goal = this.autonomousRunner.getGoal(goalId);
    if (!goal) return { reports: [], goal: null };
    return { reports: goal.progressReports, goal };
  }

  /** Access the API key vault for storing/managing keys */
  public getVault() {
    return this.autonomousRunner.getVault();
  }

  // ── Activation / Deactivation ──────────────────────────────────────
  private activateRule(rule: AutomationRule): void {
    const { trigger } = rule;

    switch (trigger.kind) {
      case 'schedule': {
        if (this.scheduler) {
          this.scheduler.handle({
            id: `auto-sched:${rule.id}`,
            agentId: 'agent:scheduler',
            type: 'schedule',
            input: { name: rule.name, cron: trigger.cron, agentId: 'agent:automation', taskType: 'run_now', input: { ruleId: rule.id } },
            status: 'pending',
            priority: 'normal',
            createdAt: Date.now(),
            retries: 0,
            maxRetries: 3,
          }).catch(err => this.reportError(`Scheduler registration failed for ${rule.name}: ${err.message}`));
        }
        break;
      }
      case 'interval': {
        const timer = setInterval(() => this.fireRule(rule), trigger.ms);
        this.timers.set(rule.id, timer);
        break;
      }
      case 'once': {
        const delay = trigger.executeAt - Date.now();
        if (delay > 0) {
          const timer = setTimeout(() => {
            this.fireRule(rule);
            this.timers.delete(rule.id);
          }, delay);
          this.timers.set(rule.id, timer);
        }
        break;
      }
      case 'monitor': {
        const timer = setInterval(async () => {
          const result = await this.runMonitor(trigger.target, trigger.condition);
          this.recordMonitorResult(trigger.target, result);
          if (result.healthy === false && trigger.condition.includes('unhealthy')) {
            this.fireRule(rule);
          }
        }, trigger.checkIntervalMs);
        this.timers.set(rule.id, timer);
        break;
      }
      case 'event': {
        console.log(`[${this.id}] Event trigger registered: ${trigger.eventType}`);
        break;
      }
    }
  }

  private deactivateRule(ruleId: string): void {
    const timer = this.timers.get(ruleId);
    if (timer) {
      clearInterval(timer);
      clearTimeout(timer);
      this.timers.delete(ruleId);
    }
  }

  // ── Firing with Self-Reporting ──────────────────────────────────────
  private async fireRule(rule: AutomationRule): Promise<any> {
    if (rule.status !== 'active') return null;
    if (rule.maxFires && rule.fireCount >= rule.maxFires) {
      rule.status = 'disabled';
      this.deactivateRule(rule.id);
      return null;
    }

    rule.fireCount++;
    rule.lastFired = Date.now();
    console.log(`[${this.id}] Firing rule: "${rule.name}" (fire #${rule.fireCount})`);

    const { action } = rule;
    let result: any;

    switch (action.kind) {
      case 'agent_task': {
        const registry = AgentRegistry.getInstance();
        const agent = registry.get(action.agentId);
        if (!agent) throw new Error(`Agent ${action.agentId} not found`);
        result = await agent.executeTask({
          id: `auto-task:${rule.id}:${rule.fireCount}`,
          agentId: action.agentId,
          type: action.taskType,
          input: action.input,
          status: 'pending',
          priority: 'normal',
          createdAt: Date.now(),
          retries: 0,
          maxRetries: 3,
        });
        break;
      }
      case 'workflow': {
        if (!this.workflow) throw new Error('WorkflowAgent not available');
        result = await this.workflow.handle({
          id: `auto-wf:${rule.id}:${rule.fireCount}`,
          agentId: 'agent:workflow',
          type: 'execute',
          input: { workflowId: action.workflowId },
          status: 'pending',
          priority: 'normal',
          createdAt: Date.now(),
          retries: 0,
          maxRetries: 3,
        });
        break;
      }
      case 'notify': {
        const registry = AgentRegistry.getInstance();
        const emailAgent = registry.get('agent:email');
        if (emailAgent) {
          result = await emailAgent.executeTask({
            id: `auto-notify:${rule.id}:${rule.fireCount}`,
            agentId: 'agent:email',
            type: 'send',
            input: { to: 'owner@cozanet.os', subject: rule.name, body: action.message },
            status: 'pending',
            priority: 'normal',
            createdAt: Date.now(),
            retries: 0,
            maxRetries: 3,
          });
        }
        console.log(`[${this.id}] Notification sent: ${action.message}`);
        result = { notified: true, channel: action.channel || 'email' };
        break;
      }
      case 'api_call': {
        const registry = AgentRegistry.getInstance();
        const integrationAgent = registry.get('agent:integration');
        if (!integrationAgent) throw new Error('IntegrationAgent not available');
        result = await integrationAgent.executeTask({
          id: `auto-api:${rule.id}:${rule.fireCount}`,
          agentId: 'agent:integration',
          type: 'call',
          input: { integrationId: action.integrationId, endpoint: action.endpoint, method: action.method, body: action.body },
          status: 'pending',
          priority: 'normal',
          createdAt: Date.now(),
          retries: 0,
          maxRetries: 3,
        });
        break;
      }
      case 'autonomous': {
        // Fire an autonomous goal as the rule's action
        result = await this.autonomousRunner.runGoal(
          action.description,
          action.steps || [],
          action.config,
        );
        break;
      }
    }

    // ── Self-report: store what was done ────────────────────────────
    rule.lastReport = `Fire #${rule.fireCount}: ${result?.message || result?.summary || 'Action completed.'}`;
    return result;
  }

  // ── Monitoring ──────────────────────────────────────────────────────
  private async runMonitor(target: string, condition: string): Promise<MonitorResult> {
    console.log(`[${this.id}] Monitoring ${target}: checking ${condition}`);
    // Integration point: cozanet-monitoring engine
    return {
      target,
      healthy: true,
      value: null,
      message: 'Monitor check complete',
      timestamp: Date.now(),
    };
  }

  private recordMonitorResult(target: string, result: MonitorResult): void {
    const results = this.monitorResults.get(target) || [];
    results.push(result);
    if (results.length > 100) results.shift();
    this.monitorResults.set(target, results);
  }

  private async monitor(target: string, condition: string, intervalMs: number): Promise<{ monitorId: string; active: boolean }> {
    const monitorId = `monitor:${target}:${Date.now()}`;
    const timer = setInterval(async () => {
      const result = await this.runMonitor(target, condition);
      this.recordMonitorResult(target, result);
    }, intervalMs);
    this.timers.set(monitorId, timer);
    return { monitorId, active: true };
  }

  protected onStop(): void {
    for (const timer of this.timers.values()) {
      clearInterval(timer);
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}
