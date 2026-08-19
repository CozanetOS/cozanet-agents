// ── Shared types for ModelAdapter ─────────────────────────────────────

export type ProviderName = 'groq' | 'openai' | 'anthropic' | 'local';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
}

export interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  stop?: string[];
}

export interface CompletionResult {
  text: string;
  provider: ProviderName;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow: number;
  description?: string;
}

export interface ModelProvider {
  name: ProviderName;
  isAvailable(): boolean;
  getModels(): ModelInfo[];
  generateCompletion(messages: ChatMessage[], options?: CompletionOptions): Promise<CompletionResult>;
  generateEmbedding(text: string): Promise<number[]>;
}
