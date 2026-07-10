import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';

export class PlannerAgent extends BaseAgent {
  constructor() {
    super('agent:planner', 'Planner Agent', 'Task Planning & Breakdown');
  }

  public async handle(task: AgentTask): Promise<any> {
    if (task.type === 'plan') {
      return this.plan(task.input.goal);
    }
    throw new Error(`Unsupported task type: ${task.type}`);
  }

  private async plan(goal: string): Promise<{ steps: any[] }> {
    console.log(`PlannerAgent breaking down goal: ${goal}`);
    // Simulate smart breakdown based on standard agent roles
    return {
      steps: [
        {
          description: `Research info on "${goal}"`,
          assignee: 'agent:research',
          type: 'research',
          input: { topic: goal }
        },
        {
          description: `Generate software structure/code for "${goal}"`,
          assignee: 'agent:coding',
          type: 'generate_code',
          input: { spec: `Specification derived from ${goal}`, language: 'typescript' }
        }
      ]
    };
  }
}
