// ── ModelAdapter ──────────────────────────────────────────────────────
//
//  COZANET OS → AGENT RUNTIME → MODEL ADAPTER → MODEL PROVIDER
//
//  The provider is replaceable. The system remains useful if a provider
//  changes pricing, limits, or availability.
//
//  v0.3.0 — Real implementations. All providers now make actual API calls.
//  Fallback chain respects rate-limit cooldowns (don't retry a 429'd key
//  for 60s). Tool calling supported across all OpenAI-compatible providers
//  and Anthropic.

import {
  ChatMessage, CompletionOptions, CompletionResult,
  KeyHealth, ModelInfo, ModelProvider, ProviderName,
} from './types';
import { createProviders } from './providers';

// Default provider priority — free first, paid as fallback
// Provider priority — ordered by cost (free first) and reliability.
// GitHub Models is being retired (410 brownout) — removed from chain.
// Providers with no API key are automatically skipped by isAvailable().
const DEFAULT_PRIORITY: ProviderName[] = [
  'groq',        // Free tier, fastest inference
  'openrouter',  // Free models (openrouter/free auto-routes to available)
  'openai',      // Paid (if key set)
  'anthropic',   // Paid (if key set)
  'github',      // Deprecated (retirement in progress) — kept for when it's back
  'local',       // Last resort fallback
];

const COOLDOWN_MS = 60_000; // 60s cooldown after a 429

export class ModelAdapter {
  private static instance: ModelAdapter | null = null;
  private providers: Map<ProviderName, ModelProvider>;
  private priority: ProviderName[];
  private cooldowns: Map<ProviderName, number> = new Map();
  private stats: Map<ProviderName, { calls: number; successes: number; failures: number; lastError?: string }> = new Map();

  private constructor() {
    this.providers = createProviders();
    this.priority = [...DEFAULT_PRIORITY];
  }

  static getInstance(): ModelAdapter {
    if (!ModelAdapter.instance) {
      ModelAdapter.instance = new ModelAdapter();
    }
    return ModelAdapter.instance;
  }

  // ── Registration ────────────────────────────────────────────────────
  registerProvider(name: ProviderName, provider: ModelProvider): void {
    this.providers.set(name, provider);
    console.log(`[ModelAdapter] Registered provider: ${name} (available: ${provider.isAvailable()})`);
  }

  // ── Configuration ───────────────────────────────────────────────────
  setPriority(chain: ProviderName[]): void {
    this.priority = chain;
  }

  getPriority(): ProviderName[] {
    return [...this.priority];
  }

  // ── Cooldown Management ────────────────────────────────────────────
  private isCoolingDown(provider: ProviderName): boolean {
    const until = this.cooldowns.get(provider);
    return !!until && Date.now() < until;
  }

  private setCooldown(provider: ProviderName, ms: number = COOLDOWN_MS): void {
    this.cooldowns.set(provider, Date.now() + ms);
  }

  private recordSuccess(provider: ProviderName): void {
    const s = this.stats.get(provider) || { calls: 0, successes: 0, failures: 0 };
    s.calls++;
    s.successes++;
    this.stats.set(provider, s);
  }

  private recordFailure(provider: ProviderName, error?: string): void {
    const s = this.stats.get(provider) || { calls: 0, successes: 0, failures: 0 };
    s.calls++;
    s.failures++;
    s.lastError = error;
    this.stats.set(provider, s);
  }

  // ── Generation with smart fallback ──────────────────────────────────
  async generate(messages: ChatMessage[], options?: CompletionOptions): Promise<CompletionResult> {
    const errors: string[] = [];

    for (const name of this.priority) {
      // Skip providers that are cooling down
      if (this.isCoolingDown(name)) {
        continue;
      }

      const provider = this.providers.get(name);
      if (!provider || !provider.isAvailable()) {
        continue;
      }

      try {
        const result = await provider.generateCompletion(messages, options);
        this.recordSuccess(name);

        // Clear cooldown on success — provider is healthy
        this.cooldowns.delete(name);

        return result;
      } catch (err: any) {
        const msg = err.message || String(err);
        this.recordFailure(name, msg);

        // 429 = rate limited → set cooldown
        if (err.status === 429 || msg.includes('429') || msg.includes('rate limit')) {
          this.setCooldown(name, COOLDOWN_MS);
          console.warn(`[ModelAdapter] ${name} rate limited — cooling down for ${COOLDOWN_MS / 1000}s`);
        } else {
          console.warn(`[ModelAdapter] ${name} failed: ${msg.slice(0, 100)}`);
        }

        errors.push(`${name}: ${msg.slice(0, 150)}`);
      }
    }

    // All providers exhausted — throw with full diagnostic
    throw new Error(
      `All providers exhausted. Errors:\n${errors.map(e => `  - ${e}`).join('\n')}`
    );
  }

  // ── Embeddings ──────────────────────────────────────────────────────
  async embed(text: string): Promise<number[]> {
    for (const name of this.priority) {
      if (this.isCoolingDown(name)) continue;
      const provider = this.providers.get(name);
      if (!provider?.isAvailable()) continue;
      try {
        const embedding = await provider.generateEmbedding(text);
        if (embedding.length > 0) return embedding;
      } catch (err) {
        console.warn(`[ModelAdapter] ${name} embedding failed: ${(err as Error).message}`);
      }
    }
    return [];
  }

  // ── Introspection ──────────────────────────────────────────────────
  listProviders(): { name: ProviderName; available: boolean; coolingDown: boolean; models: ModelInfo[] }[] {
    return this.priority.map(name => {
      const provider = this.providers.get(name);
      return {
        name,
        available: provider?.isAvailable() ?? false,
        coolingDown: this.isCoolingDown(name),
        models: provider?.getModels() ?? [],
      };
    });
  }

  getStats(): Record<string, { calls: number; successes: number; failures: number; lastError?: string }> {
    const out: any = {};
    for (const [name, stats] of this.stats) {
      out[name] = stats;
    }
    return out;
  }

  getPrimaryProvider(): ProviderName {
    // Return the first available, non-cooling-down provider
    for (const name of this.priority) {
      if (this.isCoolingDown(name)) continue;
      const provider = this.providers.get(name);
      if (provider?.isAvailable()) return name;
    }
    return 'local';
  }
}
