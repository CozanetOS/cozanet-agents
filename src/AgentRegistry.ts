import { BaseAgent } from './base/BaseAgent';
import { AgentMessage } from './types';

export class AgentRegistry {
  private static instance: AgentRegistry;
  private agents: Map<string, BaseAgent> = new Map();

  private constructor() {}

  public static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry();
    }
    return AgentRegistry.instance;
  }

  public register(agent: BaseAgent): void {
    this.agents.set(agent.id, agent);
    console.log(`Agent ${agent.name} registered successfully.`);
  }

  public get(id: string): BaseAgent | null {
    return this.agents.get(id) || null;
  }

  public list(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  public broadcast(msg: AgentMessage): void {
    console.log(`Broadcasting message from ${msg.from}:`, msg.payload);
    for (const agent of this.agents.values()) {
      if (agent.id !== msg.from) {
        agent.receiveMessage(msg);
      }
    }
  }
}
