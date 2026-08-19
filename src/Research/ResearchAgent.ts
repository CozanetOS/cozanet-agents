import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';
import { ContextManager } from '../context/ContextManager';

export interface ResearchResult {
  topic: string;
  summary: string;
  sources: string[];
  confidence: number;
  relatedTopics: string[];
}

/**
 * ResearchAgent — gathers, synthesizes, and summarizes information.
 * Upgraded v0.2.0: structured results, confidence scoring, related topic discovery.
 */
export class ResearchAgent extends BaseAgent {
  constructor() {
    super('agent:research', 'Research Agent', 'Information Gathering & Synthesis');

    this.registerCapability({
      name: 'research',
      description: 'Research topics, synthesize information, and provide summaries',
      taskTypes: ['research', 'summarize', 'fact_check'],
    });
  }

  protected onStart(): void {
    console.log(`[${this.id}] Research Agent online — ready to investigate.`);
  }

  public async handle(task: AgentTask): Promise<any> {
    switch (task.type) {
      case 'research':
        return this.research(task.input.topic);
      case 'summarize':
        return this.summarize(task.input.content, task.input.maxWords);
      case 'fact_check':
        return this.factCheck(task.input.claim);
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  public async research(topic: string): Promise<ResearchResult> {
    console.log(`[${this.id}] Researching: ${topic}`);

    // Integration point: calls cozanet-api LLM provider for synthesis
    const summary = `Comprehensive synthesis for "${topic}" — key findings, trends, and contextual analysis mapped via CozanetOS API.`;

    return {
      topic,
      summary,
      sources: ['cozanet-api://groq', 'cozanet-api://openai', 'cozanet-memory://vector-search'],
      confidence: 0.85,
      relatedTopics: this.extractRelatedTopics(topic),
    };
  }

  public async summarize(content: string, maxWords = 200): Promise<string> {
    console.log(`[${this.id}] Summarizing ${content.length} chars → ~${maxWords} words`);
    // Integration point: LLM-powered summarization
    return content.slice(0, maxWords * 6); // Placeholder truncation
  }

  public async factCheck(claim: string): Promise<{ claim: string; verdict: string; confidence: number; sources: string[] }> {
    console.log(`[${this.id}] Fact-checking: ${claim}`);
    return {
      claim,
      verdict: 'unverified',
      confidence: 0.5,
      sources: ['cozanet-api://groq'],
    };
  }

  private extractRelatedTopics(topic: string): string[] {
    // Placeholder — would use LLM to suggest related areas
    return [`${topic} — recent developments`, `${topic} — best practices`, `${topic} — common pitfalls`];
  }

  // ── Domain Context (v0.2.0 — lazy loading: Research + Funding domains) ────────────────
  private context: string | null = null;

  /**
   * Load domain-specific context. Lazy-loads only relevant sections,
   * NOT the full 60K master context document.
   */
  public getContext(): string {
    if (!this.context) {
      this.context = ContextManager.loadDomainContext('Research');
    }
    return this.context;
  }

  public refreshContext(): void {
    this.context = null;
  }

}
