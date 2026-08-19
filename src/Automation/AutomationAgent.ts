import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';
import { SchedulerAgent, ScheduledJob } from '../Scheduler/SchedulerAgent';
import { WorkflowAgent, WorkflowDef } from '../Workflow/WorkflowAgent';
import { AgentRegistry } from '../AgentRegistry';

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
  | { kind: 'api_call'; integrationId: string; endpoint: string; method: string; body?: any };

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
 *
 * Think of it as the employee that never sleeps — it shows up, does the work,
 * reports back, and comes back on the next cycle automatically.
 *
 * Integration points: cozanet-automation, cozanet-monitoring, cozanet-scheduler.
 */
export class AutomationAgent extends BaseAgent {
  private rules: Map<string, AutomationRule> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private monitorResults: Map<string, MonitorResult[]> = new Map();
  private scheduler: SchedulerAgent | null = null;
  private workflow: WorkflowAgent | null = null;

  constructor() {
    super('agent:automation', 'Automation Agent', 'Recurring Jobs, Monitoring & Background Workers');

    this.registerCapability({
      name: 'automation',
      description: 'Schedule recurring tasks, monitor targets, trigger actions on conditions, run background workers',
      taskTypes: ['create_rule', 'pause_rule', 'resume_rule', 'delete_rule', 'list_rules', 'monitor', 'run_now', 'get_status'],
    });
  }

  protected onStart(): void {
    console.log(`[${this.id}] Automation Agent online — the worker that never sleeps.`);

    // Link to sibling agents
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

  // ── Activation / Deactivation ──────────────────────────────────────
  private activateRule(rule: AutomationRule): void {
    const { trigger } = rule;

    switch (trigger.kind) {
      case 'schedule': {
        // Register with SchedulerAgent for cron-based firing
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
        // Register for event-based triggers — integration point: cozanet-automation event bus
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

  // ── Firing ──────────────────────────────────────────────────────────
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
    switch (action.kind) {
      case 'agent_task': {
        const registry = AgentRegistry.getInstance();
        const agent = registry.get(action.agentId);
        if (!agent) throw new Error(`Agent ${action.agentId} not found`);
        return agent.executeTask({
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
      }
      case 'workflow': {
        if (!this.workflow) throw new Error('WorkflowAgent not available');
        return this.workflow.handle({
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
      }
      case 'notify': {
        console.log(`[${this.id}] NOTIFICATION: ${action.message}`);
        // Integration point: route to cozanet-communication (push, email, Slack, etc.)
        return { notified: true, message: action.message, channel: action.channel };
      }
      case 'api_call': {
        const integrationAgent = AgentRegistry.getInstance().get('agent:integration');
        if (!integrationAgent) throw new Error('IntegrationAgent not available');
        return integrationAgent.handle({
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
      }
    }
  }

  // ── Monitoring ─────────────────────────────────────────────────────
  private async monitor(target: string, condition: string, intervalMs: number): Promise<{ monitorId: string; target: string; active: boolean }> {
    const monitorId = `monitor:${target}:${Date.now()}`;
    console.log(`[${this.id}] Starting monitor on "${target}" every ${intervalMs}ms (condition: ${condition})`);

    const timer = setInterval(async () => {
      const result = await this.runMonitor(target, condition);
      this.recordMonitorResult(target, result);
      console.log(`[${this.id}] Monitor ${target}: ${result.healthy ? 'healthy' : 'UNHEALTHY'} — ${result.message}`);
    }, intervalMs);

    this.timers.set(monitorId, timer);
    return { monitorId, target, active: true };
  }

  private async runMonitor(target: string, condition: string): Promise<MonitorResult> {
    // Integration point: check cozanet-monitoring for target health
    // Placeholder: always returns healthy
    return {
      target,
      healthy: true,
      value: 'ok',
      message: `${target} is operating normally`,
      timestamp: Date.now(),
    };
  }

  private recordMonitorResult(target: string, result: MonitorResult): void {
    if (!this.monitorResults.has(target)) {
      this.monitorResults.set(target, []);
    }
    const history = this.monitorResults.get(target)!;
    history.push(result);
    // Keep last 100 results
    if (history.length > 100) history.shift();
  }

  // ── Cleanup ────────────────────────────────────────────────────────
  protected onStop(): void {
    for (const timer of this.timers.values()) {
      clearInterval(timer);
      clearTimeout(timer);
    }
    this.timers.clear();
    console.log(`[${this.id}] Automation Agent stopped — all timers cleared.`);
  }
}
