import { AgentRegistry } from './AgentRegistry';
import { BaseAgent } from './base/BaseAgent';
import { CEOAgent } from './CEO/CEOAgent';
import { ResearchAgent } from './Research/ResearchAgent';
import { CodingAgent } from './Coding/CodingAgent';
import { MemoryAgent } from './Memory/MemoryAgent';
import { PlannerAgent } from './Planner/PlannerAgent';
import { AgentTask, Agent } from './types';

export class AgentOrchestrator {
  private registry = AgentRegistry.getInstance();

  public async initialize(): Promise<void> {
    console.log('Initializing Agent Orchestrator & Registering Core Agents...');
    
    const ceo = new CEOAgent();
    const research = new ResearchAgent();
    const coding = new CodingAgent();
    const memory = new MemoryAgent();
    const planner = new PlannerAgent();

    this.registry.register(ceo);
    this.registry.register(research);
    this.registry.register(coding);
    this.registry.register(memory);
    this.registry.register(planner);

    // Start all agents
    for (const agent of this.registry.list()) {
      agent.start();
    }
  }

  public async submitTask(task: AgentTask): Promise<any> {
    console.log(`Submitting task ${task.id} to agent ${task.agentId}`);
    const agent = this.registry.get(task.agentId);
    if (!agent) {
      throw new Error(`Target Agent ${task.agentId} is not registered.`);
    }
    task.status = 'running';
    try {
      const output = await agent.handle(task);
      task.status = 'done';
      task.output = output;
      task.completedAt = Date.now();
      return output;
    } catch (err: any) {
      task.status = 'failed';
      task.output = err.message;
      throw err;
    }
  }

  public getAgentStatus(id: string): Agent {
    const agent = this.registry.get(id);
    if (!agent) {
      throw new Error(`Agent ${id} not found.`);
    }
    return {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      status: agent.getStatus(),
      capabilities: [] // Can be filled dynamically
    };
  }
}
