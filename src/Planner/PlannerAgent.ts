import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';

export interface PlanStep {
  description: string;
  assignee: string;
  type: string;
  input: any;
  priority: 'low' | 'normal' | 'high' | 'critical';
  dependencies: string[];
}

export interface PlanResult {
  steps: PlanStep[];
  estimatedDuration: string;
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * PlannerAgent — breaks down goals into actionable, prioritized steps.
 * Upgraded v0.2.0: dependency tracking, priority assignment, risk assessment,
 *   multi-strategy planning, step estimation.
 */
export class PlannerAgent extends BaseAgent {
  constructor() {
    super('agent:planner', 'Planner Agent', 'Task Planning & Breakdown');

    this.registerCapability({
      name: 'planning',
      description: 'Decompose goals into prioritized, dependency-aware steps',
      taskTypes: ['plan', 'replan', 'estimate', 'prioritize'],
    });
  }

  protected onStart(): void {
    console.log(`[${this.id}] Planner Agent online — ready to strategize.`);
  }

  public async handle(task: AgentTask): Promise<any> {
    switch (task.type) {
      case 'plan':
        return this.plan(task.input.goal);
      case 'replan':
        return this.replan(task.input.goal, task.input.completedSteps, task.input.failedStep);
      case 'estimate':
        return this.estimate(task.input.steps);
      case 'prioritize':
        return this.prioritize(task.input.steps);
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  private async plan(goal: string): Promise<PlanResult> {
    console.log(`[${this.id}] Breaking down goal: ${goal}`);

    const steps: PlanStep[] = [
      {
        description: `Research information on "${goal}"`,
        assignee: 'agent:research',
        type: 'research',
        input: { topic: goal },
        priority: 'high',
        dependencies: [],
      },
      {
        description: `Generate software structure for "${goal}"`,
        assignee: 'agent:coding',
        type: 'generate_code',
        input: { spec: `Specification derived from ${goal}`, language: 'typescript' },
        priority: 'normal',
        dependencies: ['agent:research'],
      },
      {
        description: `Review generated code for "${goal}"`,
        assignee: 'agent:review',
        type: 'review_code',
        input: { code: '' },
        priority: 'normal',
        dependencies: ['agent:coding'],
      },
      {
        description: `Run tests for "${goal}" implementation`,
        assignee: 'agent:testing',
        type: 'run_tests',
        input: { code: '', framework: 'jest' },
        priority: 'high',
        dependencies: ['agent:review'],
      },
      {
        description: `Security scan for "${goal}"`,
        assignee: 'agent:security',
        type: 'scan',
        input: { target: goal },
        priority: 'high',
        dependencies: ['agent:coding'],
      },
    ];

    return {
      steps,
      estimatedDuration: '~5-10 min',
      riskLevel: 'low',
    };
  }

  private async replan(goal: string, completedSteps: string[], failedStep: string): Promise<PlanResult> {
    console.log(`[${this.id}] Replanning after failure at: ${failedStep}`);
    const freshPlan = await this.plan(goal);
    freshPlan.steps = freshPlan.steps.filter(s => !completedSteps.includes(s.assignee));
    freshPlan.riskLevel = 'medium';
    return freshPlan;
  }

  private async estimate(steps: PlanStep[]): Promise<{ totalTime: string; perStep: Record<string, string> }> {
    const perStep: Record<string, string> = {};
    for (const step of steps) {
      perStep[step.description] = '~1-2 min';
    }
    return { totalTime: `~${steps.length * 2} min`, perStep };
  }

  private async prioritize(steps: PlanStep[]): Promise<PlanStep[]> {
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    return [...steps].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }
}
