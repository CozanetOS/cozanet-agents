import { AgentTask, AgentMessage } from '../types';

export abstract class BaseAgent {
  public id: string;
  public name: string;
  public role: string;
  protected status: 'idle' | 'running' | 'paused' | 'error' = 'idle';
  protected handlers: Function[] = [];

  constructor(id: string, name: string, role: string) {
    this.id = id;
    this.name = name;
    this.role = role;
  }

  public abstract handle(task: AgentTask): Promise<any>;

  public start(): void {
    this.status = 'running';
    console.log(`Agent ${this.name} (${this.id}) started.`);
  }

  public stop(): void {
    this.status = 'idle';
    console.log(`Agent ${this.name} (${this.id}) stopped.`);
  }

  public sendMessage(to: string, payload: any): void {
    const msg: AgentMessage = {
      from: this.id,
      to,
      type: 'direct',
      payload
    };
    // Direct routing to other agents can be plugged in here or handled by the registry
    console.log(`[${this.id} -> ${to}]:`, payload);
  }

  public onMessage(handler: Function): void {
    this.handlers.push(handler);
  }

  public receiveMessage(msg: AgentMessage): void {
    for (const handler of this.handlers) {
      handler(msg);
    }
  }

  public getStatus() {
    return this.status;
  }
}
