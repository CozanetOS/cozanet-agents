import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';

export interface ResearchResult {
  topic: string;
  summary: string;
  sources: string[];
}

export class ResearchAgent extends BaseAgent {
  constructor() {
    super('agent:research', 'Research Agent', 'Information Gathering & Synthesis');
  }

  public async handle(task: AgentTask): Promise<any> {
    if (task.type === 'research') {
      return this.research(task.input.topic);
    }
    throw new Error(`Unsupported task type: ${task.type}`);
  }

  public async research(topic: string): Promise<ResearchResult> {
    console.log(`ResearchAgent searching for: ${topic}`);
    
    // Calls Groq via cozanet-api groq provider to generate a research summary
    // Simulation / integration placeholder:
    const summary = `Generated synthesis for "${topic}" using Groq provider on CozanetOS API. Detailed context regarding ${topic} has been mapped.`;
    
    return {
      topic,
      summary,
      sources: ['cozanet-api://groq']
    };
  }
}
