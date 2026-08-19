import { BaseAgent } from './base/BaseAgent';
import { AgentMessage, AgentCapability, AgentHealth, AgentEvent, EventHandler } from './types';

/**
 * AgentRegistry — singleton registry for all CozanetOS agents.
 *
 * v0.2.0 upgrades:
 *  - Unregister agents
 *  - Capability-based lookup
 *  - Health monitoring
 *  - Event forwarding from registered agents
 *  - Broadcast with filtering
 */
export class AgentRegistry {
  private static instance: AgentRegistry;
  private agents: Map<string, BaseAgent> = new Map();
  private globalEventHandlers: EventHandler[] = [];

  private constructor() {}

  public static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry();
    }
    return AgentRegistry.instance;
  }

  // ── Registration ────────────────────────────────────────────────────
  public register(agent: BaseAgent): void {
    // Wire agent events to the registry's global handlers
    agent.on((event) => this.forwardEvent(event));
    this.agents.set(agent.id, agent);
  }

  public unregister(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.terminate();
    }
    return this.agents.delete(agentId);
  }

  // ── Lookup ─────────────────────────────────────────────────────────
  public get(id: string): BaseAgent | null {
    return this.agents.get(id) || null;
  }

  public list(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  public listByStatus(status: string): BaseAgent[] {
    return this.list().filter(a => a.getStatus() === status);
  }

  public findByCapability(capabilityName: string): BaseAgent[] {
    return this.list().filter(a =>
      a.getCapabilities().some(c => c.name === capabilityName)
    );
  }

  public findByTaskType(taskType: string): BaseAgent[] {
    return this.list().filter(a => a.supportsTaskType(taskType));
  }

  // ── Messaging ──────────────────────────────────────────────────────
  public broadcast(msg: AgentMessage): void {
    for (const agent of this.agents.values()) {
      if (agent.id !== msg.from) {
        agent.receiveMessage(msg);
      }
    }
  }

  public sendTo(agentId: string, msg: AgentMessage): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;
    agent.receiveMessage(msg);
    return true;
  }

  // ── Health ─────────────────────────────────────────────────────────
  public getHealth(agentId: string): AgentHealth | null {
    const agent = this.agents.get(agentId);
    if (!agent) return null;

    const stats = agent.getStats();
    const total = stats.tasksCompleted + stats.tasksFailed;
    const errorRate = total > 0 ? stats.tasksFailed / total : 0;

    return {
      agentId: agent.id,
      status: agent.getStatus(),
      healthy: agent.isHealthy(),
      lastHeartbeat: stats.lastActiveAt,
      tasksCompleted: stats.tasksCompleted,
      tasksFailed: stats.tasksFailed,
      errorRate,
    };
  }

  public getHealthAll(): AgentHealth[] {
    return this.list().map(a => this.getHealth(a.id)!).filter(Boolean);
  }

  // ── Events ─────────────────────────────────────────────────────────
  public onEvent(handler: EventHandler): void {
    this.globalEventHandlers.push(handler);
  }

  private forwardEvent(event: AgentEvent): void {
    for (const handler of this.globalEventHandlers) {
      try {
        handler(event);
      } catch {
        // Swallow
      }
    }
  }

  // ── Utility ────────────────────────────────────────────────────────
  public size(): number {
    return this.agents.size;
  }

  public clear(): void {
    for (const agent of this.agents.values()) {
      agent.terminate();
    }
    this.agents.clear();
  }
}
