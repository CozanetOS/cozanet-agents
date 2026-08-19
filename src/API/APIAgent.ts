import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';

export interface ProviderInfo {
  name: string;
  models: string[];
  costPer1k: { input: number; output: number };
  rateLimit: number;
  available: boolean;
}

export interface APICallResult {
  provider: string;
  model: string;
  response: any;
  tokensUsed: { input: number; output: number };
  cost: number;
  latencyMs: number;
}

/**
 * APIAgent — manages the API registry, credentials vault, and provider routing.
 * Routes requests to the optimal LLM provider based on cost, latency, and capability.
 * Integration point: cozanet-api engine.
 */
export class APIAgent extends BaseAgent {
  private providers: Map<string, ProviderInfo> = new Map();

  constructor() {
    super('agent:api', 'API Agent', 'API Registry & Provider Routing');

    this.registerCapability({
      name: 'api',
      description: 'Route requests to LLM providers, manage credentials, track costs',
      taskTypes: ['call', 'register_provider', 'list_providers', 'estimate_cost', 'route'],
    });
  }

  protected onStart(): void {
    console.log(`[${this.id}] API Agent online — routing to providers.`);
    // Register default providers
    this.registerProvider({ name: 'groq', models: ['llama-3.3-70b', 'mixtral-8x7b'], costPer1k: { input: 0, output: 0 }, rateLimit: 30, available: true });
    this.registerProvider({ name: 'openai', models: ['gpt-4o', 'gpt-4o-mini'], costPer1k: { input: 0.005, output: 0.015 }, rateLimit: 60, available: true });
    this.registerProvider({ name: 'anthropic', models: ['claude-3.5-sonnet'], costPer1k: { input: 0.003, output: 0.015 }, rateLimit: 50, available: true });
  }

  public async handle(task: AgentTask): Promise<any> {
    switch (task.type) {
      case 'call':
        return this.call(task.input.provider, task.input.model, task.input.prompt, task.input.options);
      case 'register_provider':
        return this.registerProvider(task.input.provider);
      case 'list_providers':
        return this.listProviders();
      case 'estimate_cost':
        return this.estimateCost(task.input.provider, task.input.model, task.input.tokens);
      case 'route':
        return this.route(task.input.prompt, task.input.requirements);
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  private async registerProvider(info: ProviderInfo): Promise<{ registered: boolean; name: string }> {
    this.providers.set(info.name, info);
    return { registered: true, name: info.name };
  }

  private async call(provider: string, model: string, prompt: string, options?: any): Promise<APICallResult> {
    const info = this.providers.get(provider);
    if (!info || !info.available) {
      throw new Error(`Provider ${provider} not available`);
    }
    console.log(`[${this.id}] Calling ${provider}/${model} with ${prompt.length} chars`);
    // Integration point: cozanet-api provider routing
    return {
      provider,
      model,
      response: `Response from ${model} for: ${prompt.slice(0, 100)}`,
      tokensUsed: { input: Math.ceil(prompt.length / 4), output: 100 },
      cost: 0.001,
      latencyMs: 500,
    };
  }

  private async listProviders(): Promise<ProviderInfo[]> {
    return Array.from(this.providers.values());
  }

  private async estimateCost(provider: string, model: string, tokens: number): Promise<{ provider: string; model: string; estimatedCost: number; tokens: number }> {
    const info = this.providers.get(provider);
    if (!info) return { provider, model, estimatedCost: 0, tokens };
    const cost = (tokens / 1000) * (info.costPer1k.input + info.costPer1k.output);
    return { provider, model, estimatedCost: cost, tokens };
  }

  private async route(prompt: string, requirements?: { maxLatency?: number; maxCost?: number; minQuality?: string }): Promise<{ provider: string; model: string; reason: string }> {
    // Simple routing: prefer free providers (groq), then cheapest
    const groq = this.providers.get('groq');
    if (groq?.available) return { provider: 'groq', model: groq.models[0], reason: 'Free tier, low latency' };
    const openai = this.providers.get('openai');
    if (openai?.available) return { provider: 'openai', model: openai.models[1], reason: 'Available, cost-effective' };
    return { provider: 'none', model: 'none', reason: 'No providers available' };
  }
}
