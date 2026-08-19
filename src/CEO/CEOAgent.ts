import { BaseAgent } from '../base/BaseAgent';
import { AgentTask, AgentCapability } from '../types';
import { AgentRegistry } from '../AgentRegistry';

/**
 * CEOAgent — top-level orchestrator that plans, delegates, and coordinates.
 * Upgraded v0.2.0: capability declarations, structured planning, error-aware delegation.
 */
export class CEOAgent extends BaseAgent {
  constructor() {
    super('agent:ceo', 'CEO Agent', 'Orchestration & Coordination');

    this.registerCapability({
      name: 'orchestration',
      description: 'Plan goals and delegate tasks to specialized agents',
      taskTypes: ['orchestrate', 'delegate', 'coordinate'],
    });
  }

  public async handle(task: AgentTask): Promise<any> {
    switch (task.type) {
      case 'orchestrate':
        return this.planAndExecute(task.input.goal);
      case 'delegate':
        return this.delegate(task, task.input.agentId);
      case 'coordinate':
        return this.coordinate(task.input.tasks as AgentTask[]);
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  protected onStart(): void {
    console.log(`[${this.id}] CEO Agent online — ready to orchestrate.`);
  }

  public async delegate(task: AgentTask, agentId: string): Promise<any> {
    const agent = AgentRegistry.getInstance().get(agentId);
    if (!agent) {
      throw new Error(`Agent with ID ${agentId} not found in Registry.`);
    }
    return agent.executeTask(task);
  }

  public async planAndExecute(goal: string): Promise<any> {
    console.log(`[${this.id}] CEO planning and executing goal: ${goal}`);

    const planner = AgentRegistry.getInstance().get('agent:planner');
    if (!planner) {
      throw new Error('PlannerAgent is required for execution.');
    }

    const planTask: AgentTask = {
      id: `task:plan:${Date.now()}`,
      agentId: 'agent:planner',
      type: 'plan',
      input: { goal },
      status: 'pending',
      priority: 'high',
      createdAt: Date.now(),
      retries: 0,
      maxRetries: 3,
    };

    const planResult = await planner.executeTask(planTask);
    console.log(`[${this.id}] Received execution plan with ${planResult.steps.length} steps.`);

    const results: any[] = [];
    for (const step of planResult.steps) {
      console.log(`[${this.id}] Delegating: ${step.description} → ${step.assignee}`);

      const delegatedTask: AgentTask = {
        id: `task:step:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
        agentId: step.assignee,
        type: step.type,
        input: step.input,
        status: 'pending',
        priority: step.priority ?? 'normal',
        createdAt: Date.now(),
        retries: 0,
        maxRetries: 3,
        parentTaskId: planTask.id,
      };

      try {
        const res = await this.delegate(delegatedTask, step.assignee);
        results.push({ step: step.description, status: 'success', result: res });
      } catch (err: any) {
        results.push({ step: step.description, status: 'failed', error: err.message });
        console.error(`[${this.id}] Step failed: ${step.description} — ${err.message}`);
      }
    }

    return { status: 'success', goal, results };
  }

  public async coordinate(tasks: AgentTask[]): Promise<any[]> {
    const results = await Promise.allSettled(
      tasks.map(task => this.delegate(task, task.agentId))
    );
    return results.map((r, i) => ({
      taskId: tasks[i].id,
      status: r.status === 'fulfilled' ? 'success' : 'failed',
      result: r.status === 'fulfilled' ? r.value : (r as PromiseRejectedResult).reason?.message,
    }));
  }
}
