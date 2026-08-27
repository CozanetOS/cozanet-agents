import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';
import { APIKeyVault, APIKeyEntry, KeyValidationResult, KeyRotationResult } from '../Vault/APIKeyVault';

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
  apiKeyId?: string;
}

/**
 * APIAgent — manages the API registry, credential vault, and provider routing.
 * Routes requests to the optimal LLM provider based on cost, latency, and capability.
 *
 * v0.2.0 enhancements:
 *  - Full API key vault: store, validate, rotate, revoke, track usage
 *  - Auto-selects best active key per provider
 *  - Usage tracking: calls, tokens, cost, errors, rate limits
 *  - Key validation before use
 *  - Cost estimation per call
 *
 * Integration point: cozanet-api engine, cozanet-identity (key encryption).
 */
export class APIAgent extends BaseAgent {
  private providers: Map<string, ProviderInfo> = new Map();
  public vault: APIKeyVault;

  constructor() {
    super('agent:api', 'API Agent', 'API Registry, Key Vault & Provider Routing');

    this.registerCapability({
      name: 'api',
      description: 'Route requests to LLM providers, manage API keys, track costs and usage',
      taskTypes: [
        'call', 'register_provider', 'list_providers', 'estimate_cost', 'route',
        'store_key', 'get_key', 'validate_key', 'rotate_key', 'revoke_key',
        'delete_key', 'list_keys', 'get_usage', 'validate_all_keys', 'key_health',
      ],
    });

    this.vault = new APIKeyVault();
  }

  protected onStart(): void {
    console.log(`[${this.id}] API Agent online — routing to providers, vault ready.`);
    // Register default providers
    this.registerProvider({ name: 'groq', models: ['llama-3.3-70b', 'mixtral-8x7b'], costPer1k: { input: 0, output: 0 }, rateLimit: 30, available: true });
    this.registerProvider({ name: 'openai', models: ['gpt-4o', 'gpt-4o-mini'], costPer1k: { input: 0.005, output: 0.015 }, rateLimit: 60, available: true });
    this.registerProvider({ name: 'anthropic', models: ['claude-3.5-sonnet', 'claude-3-opus'], costPer1k: { input: 0.003, output: 0.015 }, rateLimit: 50, available: true });
    this.registerProvider({ name: 'cohere', models: ['command-r-plus'], costPer1k: { input: 0.003, output: 0.015 }, rateLimit: 40, available: true });
  }

  public async handle(task: AgentTask): Promise<any> {
    switch (task.type) {
      // Provider management
      case 'call':
        return this.call(task.input.provider, task.input.model, task.input.prompt, task.input.options);
      case 'register_provider':
        return this.registerProvider(task.input.provider || task.input);
      case 'list_providers':
        return this.listProviders();
      case 'estimate_cost':
        return this.estimateCost(task.input.provider, task.input.model, task.input.tokens);
      case 'route':
        return this.route(task.input.prompt, task.input.requirements);

      // API key vault
      case 'store_key':
        return this.storeKey(task.input);
      case 'get_key':
        return this.getKey(task.input.provider, task.input.scope);
      case 'validate_key':
        return this.validateKey(task.input.keyId);
      case 'validate_all_keys':
        return this.validateAllKeys(task.input.provider);
      case 'rotate_key':
        return this.rotateKey(task.input.keyId, task.input.newKeyValue, task.input.newExpiresAt);
      case 'revoke_key':
        return this.revokeKey(task.input.keyId);
      case 'delete_key':
        return this.deleteKey(task.input.keyId);
      case 'list_keys':
        return this.listKeys(task.input.provider, task.input.status);
      case 'get_usage':
        return this.getKeyUsage(task.input.keyId);
      case 'key_health':
        return this.getKeyHealth();

      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  // ── Provider Management ────────────────────────────────────────────

  private async registerProvider(info: ProviderInfo): Promise<{ registered: boolean; name: string }> {
    this.providers.set(info.name, info);
    return { registered: true, name: info.name };
  }

  private async call(provider: string, model: string, prompt: string, options?: any): Promise<APICallResult> {
    const info = this.providers.get(provider);
    if (!info || !info.available) {
      throw new Error(`Provider ${provider} not available`);
    }

    // Get an API key from the vault
    const key = this.vault.get(provider);
    if (!key) {
      throw new Error(`No active API key for provider: ${provider}. Store one with task type 'store_key'.`);
    }

    const startTime = Date.now();
    console.log(`[${this.id}] Calling ${provider}/${model} (key: ${key.keyPrefix})`);

    // Integration point: cozanet-api provider routing with the key
    const tokensUsed = { input: Math.ceil(prompt.length / 4), output: options?.maxTokens || 100 };
    const cost = (tokensUsed.input / 1000) * info.costPer1k.input + (tokensUsed.output / 1000) * info.costPer1k.output;

    // Make real API call to provider
    let response: any;
    let actualOutputTokens = options?.maxTokens || 100;

    try {
      const providerUrls: Record<string, string> = {
        openai: 'https://api.openai.com/v1/chat/completions',
        groq: 'https://api.groq.com/openai/v1/chat/completions',
        anthropic: 'https://api.anthropic.com/v1/messages',
        openrouter: 'https://openrouter.ai/api/v1/chat/completions',
      };

      const apiUrl = providerUrls[provider.toLowerCase()];
      if (!apiUrl) {
        throw new Error(`Unknown provider URL for: ${provider}`);
      }

      const isAnthropic = provider.toLowerCase() === 'anthropic';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (isAnthropic) {
        headers['x-api-key'] = key.keyPrefix; // In production, use decrypted full key
        headers['anthropic-version'] = '2023-06-01';
      } else {
        headers['Authorization'] = `Bearer ${key.keyPrefix}`;
      }

      const apiBody = isAnthropic ? {
        model,
        max_tokens: options?.maxTokens || 100,
        messages: [{ role: 'user', content: prompt }],
      } : {
        model,
        max_tokens: options?.maxTokens || 100,
        messages: [{ role: 'user', content: prompt }],
        temperature: options?.temperature ?? 0.7,
      };

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(apiBody),
      });

      if (res.ok) {
        const data: any = await res.json();
        response = data;
        // Extract actual token usage if available
        if (data.usage?.completion_tokens) {
          actualOutputTokens = data.usage.completion_tokens;
          tokensUsed.output = actualOutputTokens;
        }
      } else {
        const errorText = await res.text().catch(() => 'Unknown error');
        response = { error: true, status: res.status, message: errorText };
      }
    } catch (err: any) {
      response = { error: true, message: err.message };
    }

    const actualCost = (tokensUsed.input / 1000) * info.costPer1k.input + (tokensUsed.output / 1000) * info.costPer1k.output;

    const result: APICallResult = {
      provider,
      model,
      response,
      tokensUsed,
      cost: actualCost,
      latencyMs: Date.now() - startTime,
      apiKeyId: key.id,
    };

    // Record usage in the vault
    this.vault.recordUsage(key.id, {
      tokensUsed: tokensUsed.input + tokensUsed.output,
      cost,
      success: true,
    });

    return result;
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
    const available = Array.from(this.providers.values()).filter(p => p.available);
    if (available.length === 0) return { provider: 'none', model: 'none', reason: 'No providers available' };

    // Score each provider based on requirements
    const scored = available.map(p => {
      let score = 0;
      const reasons: string[] = [];

      // Cost scoring (lower cost = higher score)
      const totalCost = p.costPer1k.input + p.costPer1k.output;
      if (requirements?.maxCost && totalCost <= requirements.maxCost) {
        score += 30;
        reasons.push('within cost budget');
      } else if (totalCost === 0) {
        score += 40;
        reasons.push('free tier');
      } else if (totalCost < 0.01) {
        score += 25;
        reasons.push('low cost');
      }

      // Latency scoring (lower rate limit = potentially slower)
      if (requirements?.maxLatency) {
        score += Math.min(p.rateLimit / 10, 20);
        reasons.push('good throughput');
      }

      // Quality scoring (more models = better quality options)
      if (requirements?.minQuality === 'high' && p.models.length > 2) {
        score += 20;
        reasons.push('high quality models');
      }

      // Default: prefer free/cheap providers
      if (!requirements) {
        if (totalCost === 0) score += 50;
        score += p.models.length * 5;
      }

      return { provider: p, score, reasons };
    });

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    return {
      provider: best.provider.name,
      model: best.provider.models[0],
      reason: best.reasons.join(', ') || 'best available option',
    };
  }

  // ── API Key Vault Management ────────────────────────────────────────

  private storeKey(input: {
    provider: string;
    label: string;
    keyValue: string;
    scopes?: string[];
    expiresAt?: number;
    metadata?: Record<string, any>;
  }): APIKeyEntry {
    console.log(`[${this.id}] Storing API key for ${input.provider} (${input.label})`);
    return this.vault.store(input);
  }

  private getKey(provider: string, scope?: string): APIKeyEntry | null {
    return this.vault.get(provider, scope);
  }

  private async validateKey(keyId: string): Promise<KeyValidationResult> {
    console.log(`[${this.id}] Validating key: ${keyId}`);
    return this.vault.validate(keyId);
  }

  private async validateAllKeys(provider: string): Promise<KeyValidationResult[]> {
    return this.vault.validateAll(provider);
  }

  private async rotateKey(keyId: string, newKeyValue: string, newExpiresAt?: number): Promise<KeyRotationResult> {
    console.log(`[${this.id}] Rotating key: ${keyId}`);
    return this.vault.rotate(keyId, newKeyValue, newExpiresAt);
  }

  private revokeKey(keyId: string): { revoked: boolean; keyId: string } {
    return this.vault.revoke(keyId);
  }

  private deleteKey(keyId: string): { deleted: boolean; keyId: string } {
    return this.vault.delete(keyId);
  }

  private listKeys(provider?: string, status?: string): APIKeyEntry[] {
    return this.vault.list({ provider, status });
  }

  private getKeyUsage(keyId: string) {
    return this.vault.getUsage(keyId);
  }

  private getKeyHealth() {
    return this.vault.getHealth();
  }
}
