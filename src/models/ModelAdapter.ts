import { ChatMessage, CompletionOptions, CompletionResult, ModelInfo, ModelProvider, ProviderName } from './types';

// ── Real Provider Implementations ─────────────────────────────────────
// Each provider now makes real HTTP calls when API keys are present.

class GroqProvider implements ModelProvider {
  readonly name = 'groq' as const;
  private baseUrl = 'https://api.groq.com/openai/v1';

  isAvailable(): boolean {
    return !!(process.env.GROQ_API_KEY || process.env.GROQ_API_KEY_1);
  }

  getModels(): ModelInfo[] {
    return [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', contextWindow: 128000 },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', contextWindow: 128000 },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', contextWindow: 32768 },
    ];
  }

  private getKey(): string {
    // Standardized: check GROQ_API_KEY first, then indexed variants
    return process.env.GROQ_API_KEY || process.env.GROQ_API_KEY_1 || '';
  }

  async generateCompletion(messages: ChatMessage[], options?: CompletionOptions): Promise<CompletionResult> {
    const start = Date.now();
    const model = options?.model ?? 'llama-3.3-70b-versatile';
    const apiKey = this.getKey();

    if (!apiKey) {
      return {
        text: `[groq:stub] No GROQ_API_KEY set. Would have called ${model} with ${messages.length} messages.`,
        provider: 'groq',
        model,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        latencyMs: Date.now() - start,
      };
    }

    const body: any = {
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: options?.temperature ?? 0.7,
    };

    if (options?.maxTokens) body.max_tokens = options?.maxTokens;
    if (options?.jsonMode) body.response_format = { type: 'json_object' };

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Groq API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return {
      text: data.choices[0]?.message?.content ?? '',
      provider: 'groq',
      model,
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
      latencyMs: Date.now() - start,
    };
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const apiKey = this.getKey();
    if (!apiKey) return [];

    // Groq doesn't have embeddings yet — return empty
    // When they add it, this is where it goes
    return [];
  }
}

class OpenAIProvider implements ModelProvider {
  readonly name = 'openai' as const;
  private baseUrl = 'https://api.openai.com/v1';

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

    const body: any = {
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: options?.temperature ?? 0.7,
    };

    if (options?.maxTokens) body.max_tokens = options?.maxTokens;
    if (options?.jsonMode) body.response_format = { type: 'json_object' };

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return {
      text: data.choices[0]?.message?.content ?? '',
      provider: 'openai',
      model,
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
      latencyMs: Date.now() - start,
    };
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return [];

    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
      }),
    });

    if (!res.ok) return [];
    const data = await res.json();
    return data.data?.[0]?.embedding ?? [];
  }
}

class AnthropicProvider implements ModelProvider {
  readonly name = 'anthropic' as const;
  private baseUrl = 'https://api.anthropic.com/v1';
  private apiVersion = '2023-06-01';

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

    // Anthropic uses a different message format — system is separate
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    const body: any = {
      model,
      max_tokens: options?.maxTokens ?? 4096,
      messages: chatMessages.map(m => ({ role: m.role, content: m.content })),
    };

    if (systemMsg) body.system = systemMsg.content;

    const res = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': this.apiVersion,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return {
      text: data.content?.[0]?.text ?? '',
      provider: 'anthropic',
      model,
      usage: {
        promptTokens: data.usage?.input_tokens ?? 0,
        completionTokens: data.usage?.output_tokens ?? 0,
        totalTokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
      },
      latencyMs: Date.now() - start,
    };
  }

  async generateEmbedding(text: string): Promise<number[]> {
    // Anthropic doesn't offer embeddings
    return [];
  }
}

class LocalProvider implements ModelProvider {
  readonly name = 'local' as const;

  isAvailable(): boolean {
    return true; // Always available as fallback
  }

  getModels(): ModelInfo[] {
    return [{ id: 'local-mock', name: 'Local Mock (Fallback)', contextWindow: 4096 }];
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

  registerProvider(name: ProviderName, provider: ModelProvider): void {
    this.providers.set(name, provider);
    console.log(`[ModelAdapter] Registered provider: ${name} (available: ${provider.isAvailable()})`);
  }

  getProvider(name?: ProviderName): ModelProvider | null {
    if (name) return this.providers.get(name) ?? null;
    const primary = this.providers.get(this.primaryProvider);
    if (primary?.isAvailable()) return primary;
    for (const fallback of this.fallbackChain) {
      const p = this.providers.get(fallback);
      if (p?.isAvailable()) return p;
    }
    return null;
  }

  setPrimaryProvider(name: ProviderName): void {
    if (!this.providers.has(name)) throw new Error(`Provider "${name}" not registered`);
    this.primaryProvider = name;
    console.log(`[ModelAdapter] Primary provider set to: ${name}`);
  }

  setFallbackChain(chain: ProviderName[]): void {
    this.fallbackChain = chain;
  }

  async generate(messages: ChatMessage[], options?: CompletionOptions): Promise<CompletionResult> {
    const primary = this.getProvider(this.primaryProvider);
    if (primary?.isAvailable()) {
      try {
        return await primary.generateCompletion(messages, options);
      } catch (err) {
        console.warn(`[ModelAdapter] Primary provider "${this.primaryProvider}" failed: ${(err as Error).message}`);
      }
    }

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

    const local = this.providers.get('local');
    if (local) return local.generateCompletion(messages, options);
    throw new Error('No model providers available');
  }

  async embed(text: string): Promise<number[]> {
    // Try OpenAI for embeddings (most reliable), then any available provider
    const openai = this.providers.get('openai');
    if (openai?.isAvailable()) {
      const emb = await openai.generateEmbedding(text);
      if (emb.length > 0) return emb;
    }
    const provider = this.getProvider();
    if (provider) return provider.generateEmbedding(text);
    return [];
  }
}
