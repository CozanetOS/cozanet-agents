import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';

export class MemoryAgent extends BaseAgent {
  constructor() {
    super('agent:memory', 'Memory Agent', 'Short-term and Long-term retrieval');
  }

  public async handle(task: AgentTask): Promise<any> {
    if (task.type === 'store') {
      return this.store(task.input.key, task.input.value);
    } else if (task.type === 'retrieve') {
      return this.retrieve(task.input.key);
    }
    throw new Error(`Unsupported task type: ${task.type}`);
  }

  private async store(key: string, value: any): Promise<boolean> {
    console.log(`MemoryAgent storing key ${key} in cozanet-memory engine`);
    return true;
  }

  private async retrieve(key: string): Promise<any> {
    console.log(`MemoryAgent retrieving key ${key} from cozanet-memory engine`);
    return { key, value: `Retrieved data for ${key}` };
  }
}
