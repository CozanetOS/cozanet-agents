import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';
import { AgentRegistry } from '../AgentRegistry';

export class CEOAgent extends BaseAgent {
  constructor() {
    super('agent:ceo', 'CEO Agent', 'Orchestration & Coordination');
  }

  public async handle(task: AgentTask): Promise<any> {
    if (task.type === 'orchestrate') {
      return this.planAndExecute(task.input.goal);
    }
    throw new Error(`Unsupported task type: ${task.type}`);
  }

  public async delegate(task: AgentTask, agentId: string): Promise<any> {
    const agent = AgentRegistry.getInstance().get(agentId);
    if (!agent) {
      throw new Error(`Agent with ID ${agentId} not found in Registry.`);
    }
    return agent.handle(task);
  }

  public async planAndExecute(goal: string): Promise<any> {
    console.log(`CEO planning and executing goal: ${goal}`);
    // Step 1: Request planning steps from PlannerAgent
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
      createdAt: Date.now()
    };
    
    const planResult = await planner.handle(planTask);
    console.log('CEO received execution plan:', planResult);
    
    // Iterate through steps and delegate (example layout)
    const results: any[] = [];
    for (const step of planResult.steps) {
      console.log(`CEO delegating step: ${step.description} to ${step.assignee}`);
      const delegatedTask: AgentTask = {
        id: `task:step:${Date.now()}`,
        agentId: step.assignee,
        type: step.type,
        input: step.input,
        status: 'pending',
        createdAt: Date.now()
      };
      
      const res = await this.delegate(delegatedTask, step.assignee);
      results.push({ step: step.description, result: res });
    }
    
    return {
      status: 'success',
      goal,
      results
    };
  }
}
