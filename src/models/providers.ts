// ── Real LLM Provider Implementations ────────────────────────────────
// All providers use native fetch (Node 18+). No external dependencies.
// Each provider implements ModelProvider from types.ts.

import {
  ChatMessage, CompletionOptions, CompletionResult,
  ModelInfo, ModelProvider, ProviderName, ToolCall, LLMToolDefinition,
} from './types';

// ── Helpers ───────────────────────────────────────────────────────────

function buildHeaders(authKey: string, provider: ProviderName): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (provider === 'anthropic') {
    headers['x-api-key'] = authKey;
    headers['anthropic-version'] = '2023-06-01';
  } else {
    headers['Authorization'] = `Bearer ${authKey}`;
  }
  return headers;
}

// Convert our unified ChatMessage[] to OpenAI-compatible format (used by Groq, OpenAI, OpenRouter, GitHub)
function toOpenAIMessages(messages: ChatMessage[]): any[] {
  return messages.map(m => {
    const out: any = { role: m.role, content: m.content };
    if (m.name) out.name = m.name;
    if (m.toolCallId) out.tool_call_id = m.toolCallId;
    if (m.toolCalls) out.tool_calls = m.toolCalls;
    return out;
  });
}

// Convert our LLMToolDefinition[] to OpenAI-compatible format
function toOpenAITools(tools?: LLMToolDefinition[]): any[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools;
}

// ── OpenAI-Compatible Provider Base ────────────────────────────────────
// Groq, OpenAI, OpenRouter, and GitHub Models all use the same API format.
// We share the completion logic and only differ in base URL, key, and models.

abstract class OpenAICompatibleProvider implements ModelProvider {
  abstract readonly name: ProviderName;
  abstract get baseUrl(): string;
  abstract get apiKey(): string | undefined;
  abstract get defaultModel(): string;
  abstract getModels(): ModelInfo[];

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async generateCompletion(messages: ChatMessage[], options?: CompletionOptions): Promise<CompletionResult> {
    const start = Date.now();
    const model = options?.model ?? this.defaultModel;
    const key = this.apiKey;

    if (!key) {
      throw new Error(`${this.name}: no API key configured`);
    }

    const body: any = {
      model,
      messages: toOpenAIMessages(messages),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
    };

    if (options?.stop) body.stop = options.stop;
    if (options?.responseFormat === 'json') body.response_format = { type: 'json_object' };

    const tools = toOpenAITools(options?.tools);
    if (tools) {
      body.tools = tools;
      body.tool_choice = options?.toolChoice ?? 'auto';
    }

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(key, this.name),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const err: any = new Error(`${this.name} API error ${res.status}: ${errText.slice(0, 300)}`);
      err.status = res.status;
      err.provider = this.name;
      throw err;
    }

    const data: any = await res.json();
    const choice = data.choices?.[0];

    const result: CompletionResult = {
      text: choice?.message?.content ?? '',
      provider: this.name,
      model,
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
      latencyMs: Date.now() - start,
      finishReason: choice?.finish_reason,
    };

    if (choice?.message?.tool_calls?.length) {
      result.toolCalls = choice.message.tool_calls.map((tc: any) => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.function.name, arguments: tc.function.arguments },
      }));
    }

    return result;
  }

  async generateEmbedding(_text: string): Promise<number[]> {
    // Embeddings need provider-specific endpoints — return empty for now.
    // Real implementation would call /embeddings endpoint with the right model.
    return [];
  }
}

// ── Groq ──────────────────────────────────────────────────────────────

class GroqProvider extends OpenAICompatibleProvider {
  readonly name = 'groq' as const;
  get baseUrl() { return 'https://api.groq.com/openai/v1'; }
  get apiKey() { return process.env.GROQ_API_KEY; }
  get defaultModel() { return process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'; }

  getModels(): ModelInfo[] {
    return [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', contextWindow: 128000, supportsTools: true, isFree: true },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', contextWindow: 128000, supportsTools: true, isFree: true },
      { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', contextWindow: 128000, supportsTools: true, isFree: true },
    ];
  }
}

// ── OpenAI ────────────────────────────────────────────────────────────

class OpenAIProvider extends OpenAICompatibleProvider {
  readonly name = 'openai' as const;
  get baseUrl() { return 'https://api.openai.com/v1'; }
  get apiKey() { return process.env.OPENAI_API_KEY; }
  get defaultModel() { return process.env.OPENAI_MODEL || 'gpt-4o-mini'; }

  getModels(): ModelInfo[] {
    return [
      { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, supportsTools: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o mini', contextWindow: 128000, supportsTools: true },
    ];
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.apiKey) return [];
    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: buildHeaders(this.apiKey, this.name),
      body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data: any = await res.json();
    return data.data?.[0]?.embedding ?? [];
  }
}

// ── OpenRouter (free models) ──────────────────────────────────────────

class OpenRouterProvider extends OpenAICompatibleProvider {
  readonly name = 'openrouter' as const;
  get baseUrl() { return 'https://openrouter.ai/api/v1'; }
  get apiKey() { return process.env.OPENROUTER_API_KEY; }
  get defaultModel() { return process.env.OPENROUTER_MODEL || 'minimax/minimax-m3:free'; }

  getModels(): ModelInfo[] {
    return [
      { id: 'openrouter/free', name: 'OpenRouter Free (auto-route)', contextWindow: 200000, supportsTools: true, isFree: true },
      { id: 'nvidia/nemotron-3.5-lightning:free', name: 'Nemotron 3.5 Lightning (Free)', contextWindow: 1000000, supportsTools: true, isFree: true },
      { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (Free)', contextWindow: 131072, supportsTools: true, isFree: true },
    ];
  }

  async generateCompletion(messages: ChatMessage[], options?: CompletionOptions): Promise<CompletionResult> {
    // OpenRouter needs HTTP-Referer and X-Title headers for free tier routing
    const start = Date.now();
    const model = options?.model ?? this.defaultModel;
    const key = this.apiKey;

    if (!key) throw new Error('openrouter: no API key configured');

    const body: any = {
      model,
      messages: toOpenAIMessages(messages),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
    };

    if (options?.stop) body.stop = options.stop;
    if (options?.responseFormat === 'json') body.response_format = { type: 'json_object' };

    const tools = toOpenAITools(options?.tools);
    if (tools) {
      body.tools = tools;
      body.tool_choice = options?.toolChoice ?? 'auto';
    }

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        'HTTP-Referer': 'https://cozanet.net',
        'X-Title': 'Cozanet OS',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const err: any = new Error(`openrouter API error ${res.status}: ${errText.slice(0, 300)}`);
      err.status = res.status;
      err.provider = this.name;
      throw err;
    }

    const data: any = await res.json();
    const choice = data.choices?.[0];

    const result: CompletionResult = {
      text: choice?.message?.content ?? '',
      provider: this.name,
      model,
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
      latencyMs: Date.now() - start,
      finishReason: choice?.finish_reason,
    };

    if (choice?.message?.tool_calls?.length) {
      result.toolCalls = choice.message.tool_calls.map((tc: any) => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.function.name, arguments: tc.function.arguments },
      }));
    }

    return result;
  }
}

// ── GitHub Models (free, uses GITHUB_TOKEN) ──────────────────────────

class GitHubModelsProvider extends OpenAICompatibleProvider {
  readonly name = 'github' as const;
  get baseUrl() { return 'https://models.github.ai/inference'; }
  get apiKey() { return process.env.GITHUB_TOKEN; }
  get defaultModel() { return process.env.GITHUB_MODEL || 'openai/gpt-4o'; }

  getModels(): ModelInfo[] {
    return [
      { id: 'openai/gpt-4o', name: 'GPT-4o (GitHub Models)', contextWindow: 128000, supportsTools: true, isFree: true },
      { id: 'meta/llama-3.3-70b-instruct', name: 'Llama 3.3 70B (GitHub Models)', contextWindow: 128000, supportsTools: true, isFree: true },
      { id: 'mistral-ai/Mistral-Large-2411', name: 'Mistral Large (GitHub Models)', contextWindow: 128000, supportsTools: true, isFree: true },
    ];
  }
}

// ── Anthropic (different API format) ──────────────────────────────────

class AnthropicProvider implements ModelProvider {
  readonly name = 'anthropic' as const;
  private get apiKey() { return process.env.ANTHROPIC_API_KEY; }
  private get baseUrl() { return 'https://api.anthropic.com/v1'; }
  private get defaultModel() { return process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'; }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  getModels(): ModelInfo[] {
    return [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', contextWindow: 200000, supportsTools: true },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', contextWindow: 200000, supportsTools: true },
    ];
  }

  async generateCompletion(messages: ChatMessage[], options?: CompletionOptions): Promise<CompletionResult> {
    const start = Date.now();
    const model = options?.model ?? this.defaultModel;
    const key = this.apiKey;

    if (!key) throw new Error('anthropic: no API key configured');

    // Anthropic uses a different format: separate system message, different message structure
    const systemMsg = messages.find(m => m.role === 'system')?.content || '';
    const convMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => {
        if (m.role === 'assistant' && m.toolCalls) {
          return {
            role: 'assistant',
            content: m.content || '',
            tool_calls: m.toolCalls.map(tc => ({
              id: tc.id,
              type: 'function',
              function: { name: tc.function.name, arguments: tc.function.arguments },
            })),
          };
        }
        if (m.role === 'tool') {
          return {
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: m.toolCallId, content: m.content }],
          };
        }
        return { role: m.role, content: m.content };
      });

    const body: any = {
      model,
      messages: convMessages,
      max_tokens: options?.maxTokens ?? 4096,
      system: systemMsg,
    };

    if (options?.temperature !== undefined) body.temperature = options.temperature;
    if (options?.stop) body.stop_sequences = options.stop;

    if (options?.tools) {
      body.tools = options.tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }));
    }

    const res = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: buildHeaders(key, this.name),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const err: any = new Error(`anthropic API error ${res.status}: ${errText.slice(0, 300)}`);
      err.status = res.status;
      err.provider = this.name;
      throw err;
    }

    const data: any = await res.json();
    const textContent = (data.content || []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');
    const toolUses = (data.content || []).filter((c: any) => c.type === 'tool_use');

    const result: CompletionResult = {
      text: textContent,
      provider: this.name,
      model,
      usage: {
        promptTokens: data.usage?.input_tokens ?? 0,
        completionTokens: data.usage?.output_tokens ?? 0,
        totalTokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
      },
      latencyMs: Date.now() - start,
      finishReason: data.stop_reason === 'tool_use' ? 'tool_calls' : data.stop_reason,
    };

    if (toolUses.length) {
      result.toolCalls = toolUses.map((tu: any) => ({
        id: tu.id,
        type: 'function' as const,
        function: { name: tu.name, arguments: JSON.stringify(tu.input) },
      }));
    }

    return result;
  }

  async generateEmbedding(_text: string): Promise<number[]> {
    return [];
  }
}

// ── Local Fallback (no API key needed) ─────────────────────────────────

class LocalProvider implements ModelProvider {
  readonly name = 'local' as const;

  isAvailable(): boolean {
    return true;
  }

  getModels(): ModelInfo[] {
    return [{ id: 'local-fallback', name: 'Local Fallback', contextWindow: 4096, isFree: true }];
  }

  async generateCompletion(messages: ChatMessage[], _options?: CompletionOptions): Promise<CompletionResult> {
    const start = Date.now();
    const lastMessage = messages[messages.length - 1];
    return {
      text: `[local:fallback] No providers available. Last message: "${lastMessage?.content?.slice(0, 200) ?? ''}"`,
      provider: 'local',
      model: 'local-fallback',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      latencyMs: Date.now() - start,
      finishReason: 'stop',
    };
  }

  async generateEmbedding(_text: string): Promise<number[]> {
    return [];
  }
}

// ── Provider Factory ───────────────────────────────────────────────────

export function createProviders(): Map<ProviderName, ModelProvider> {
  const map = new Map<ProviderName, ModelProvider>();
  map.set('github', new GitHubModelsProvider());
  map.set('groq', new GroqProvider());
  map.set('openrouter', new OpenRouterProvider());
  map.set('openai', new OpenAIProvider());
  map.set('anthropic', new AnthropicProvider());
  map.set('local', new LocalProvider());
  return map;
}

export {
  GroqProvider, OpenAIProvider, OpenRouterProvider,
  GitHubModelsProvider, AnthropicProvider, LocalProvider,
};
