import { ChatMessage, CompletionOptions, CompletionResult, ModelInfo, ModelProvider, ProviderName } from './types';

// ── Provider stubs ────────────────────────────────────────────────────
// Each provider has realistic structure but returns mock data when no
// API key is set. When keys ARE set, they would call the real API.

class GroqProvider implements ModelProvider {
  readonly name = 'groq' as const;

  isAvailable(): boolean {
    return true; // Groq has a free tier; always attempt
  }

  getModels(): ModelInfo[] {
    return [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', contextWindow: 128000 },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', contextWindow: 128000 },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', contextWindow: 32768 },
    ];
  }

  async generateCompletion(messages: ChatMessage[], options?: CompletionOptions): Promise<CompletionResult> {
    const start = Date.now();
    const model = options?.model ?? 'llama-3.3-70b-versatile';
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return {
        text: `[groq:stub] No GROQ_API_KEY set. Would have called ${model} with ${messages.length} messages.`,
        provider: 'groq',
        model,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        latencyMs: Date.now() - start,
      };
    }

    // Real call would go here:
    // const res = await fetch('https://api.groq.com/openai/v1/chat/completions', { ... })
    throw new Error('Groq API call not yet implemented — set up the HTTP client');
  }

  async generateEmbedding(_text: string): Promise<number[]> {
    return [];
  }
}

class OpenAIProvider implements ModelProvider {
  readonly name = 'openai' as const;

  isAvailable(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  getModels(): ModelInfo[] {
    return [
      { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000 },
      { id: 'gpt-4o-mini', name: 'GPT-4o mini', contextWindow: 128000 },
      { id: 'o1-preview', name: 'o1 Preview', contextWindow: 128000 },
    ];
  }

  async generateCompletion(messages: ChatMessage[], options?: CompletionOptions): Promise<CompletionResult> {
    const start = Date.now();
    const model = options?.model ?? 'gpt-4o-mini';
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return {
        text: `[openai:stub] No OPENAI_API_KEY set.`,
        provider: 'openai',
        model,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        latencyMs: Date.now() - start,
      };
    }

    throw new Error('OpenAI API call not yet implemented');
  }

  async generateEmbedding(_text: string): Promise<number[]> {
    return [];
  }
}

class AnthropicProvider implements ModelProvider {
  readonly name = 'anthropic' as const;

  isAvailable(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  getModels(): ModelInfo[] {
    return [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', contextWindow: 200000 },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', contextWindow: 200000 },
    ];
  }

  async generateCompletion(messages: ChatMessage[], options?: CompletionOptions): Promise<CompletionResult> {
    const start = Date.now();
    const model = options?.model ?? 'claude-sonnet-4-20250514';
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return {
        text: `[anthropic:stub] No ANTHROPIC_API_KEY set.`,
        provider: 'anthropic',
        model,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        latencyMs: Date.now() - start,
      };
    }

    throw new Error('Anthropic API call not yet implemented');
  }

  async generateEmbedding(_text: string): Promise<number[]> {
    return [];
  }
}

class LocalProvider implements ModelProvider {
  readonly name = 'local' as const;

  isAvailable(): boolean {
    return true; // Always available as fallback
  }

  getModels(): ModelInfo[] {
    return [
      { id: 'local-mock', name: 'Local Mock (Fallback)', contextWindow: 4096 },
    ];
  }

  async generateCompletion(messages: ChatMessage[], _options?: CompletionOptions): Promise<CompletionResult> {
    const start = Date.now();
    const lastMessage = messages[messages.length - 1];

    return {
      text: `[local:fallback] Acknowledged: "${lastMessage?.content?.slice(0, 200) ?? ''}"`,
      provider: 'local',
      model: 'local-mock',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      latencyMs: Date.now() - start,
    };
  }

  async generateEmbedding(_text: string): Promise<number[]> {
    return [];
  }
}

// ── ModelAdapter ──────────────────────────────────────────────────────
//
//  COZANET OS → AGENT RUNTIME → MODEL ADAPTER → MODEL PROVIDER
//
//  The provider is replaceable. The system remains useful if a provider
//  changes pricing, limits, or availability.

export class ModelAdapter {
  private static instance: ModelAdapter | null = null;
  private providers: Map<ProviderName, ModelProvider> = new Map();
  private primaryProvider: ProviderName = 'groq';
  private fallbackChain: ProviderName[] = ['openai', 'anthropic', 'local'];

  private constructor() {
    // Register all providers
    this.registerProvider('groq', new GroqProvider());
    this.registerProvider('openai', new OpenAIProvider());
    this.registerProvider('anthropic', new AnthropicProvider());
    this.registerProvider('local', new LocalProvider());
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

  // ── Retrieval ──────────────────────────────────────────────────────
  getProvider(name?: ProviderName): ModelProvider | null {
    if (name) {
      return this.providers.get(name) ?? null;
    }
    // Return primary if available, otherwise walk fallback chain
    const primary = this.providers.get(this.primaryProvider);
    if (primary?.isAvailable()) return primary;

    for (const fallback of this.fallbackChain) {
      const p = this.providers.get(fallback);
      if (p?.isAvailable()) return p;
    }
    return null;
  }

  // ── Configuration ───────────────────────────────────────────────────
  setPrimaryProvider(name: ProviderName): void {
    if (!this.providers.has(name)) {
      throw new Error(`Provider "${name}" not registered`);
    }
    this.primaryProvider = name;
    console.log(`[ModelAdapter] Primary provider set to: ${name}`);
  }

  setFallbackChain(chain: ProviderName[]): void {
    this.fallbackChain = chain;
  }

  // ── Generation ─────────────────────────────────────────────────────
  async generate(messages: ChatMessage[], options?: CompletionOptions): Promise<CompletionResult> {
    // Try primary provider
    const primary = this.getProvider(this.primaryProvider);
    if (primary?.isAvailable()) {
      try {
        return await primary.generateCompletion(messages, options);
      } catch (err) {
        console.warn(`[ModelAdapter] Primary provider "${this.primaryProvider}" failed: ${(err as Error).message}`);
      }
    }

    // Walk fallback chain
    for (const fallbackName of this.fallbackChain) {
      const provider = this.providers.get(fallbackName);
      if (provider?.isAvailable()) {
        try {
          console.log(`[ModelAdapter] Falling back to: ${fallbackName}`);
          return await provider.generateCompletion(messages, options);
        } catch (err) {
          console.warn(`[ModelAdapter] Fallback "${fallbackName}" failed: ${(err as Error).message}`);
        }
      }
    }

    // Last resort: local mock
    const local = this.providers.get('local');
    if (local) {
      return local.generateCompletion(messages, options);
    }

    throw new Error('No model providers available');
  }

  async embed(text: string): Promise<number[]> {
    const provider = this.getProvider();
    if (!provider) throw new Error('No provider available for embeddings');
    return provider.generateEmbedding(text);
  }

  // ── Introspection ──────────────────────────────────────────────────
  listProviders(): { name: ProviderName; available: boolean; models: ModelInfo[] }[] {
    return Array.from(this.providers.entries()).map(([name, provider]) => ({
      name,
      available: provider.isAvailable(),
      models: provider.getModels(),
    }));
  }

  getPrimaryProvider(): ProviderName {
    return this.primaryProvider;
  }
}
