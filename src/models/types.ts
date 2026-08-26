// ── Shared types for ModelAdapter ─────────────────────────────────────
// These types define the contract between the agent runtime and any
// LLM provider. Every provider must implement ModelProvider.

export type ProviderName = 'groq' | 'openai' | 'anthropic' | 'openrouter' | 'github' | 'local';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface LLMToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>; // JSON Schema
  };
}

export interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  stop?: string[];
  tools?: LLMToolDefinition[];
  toolChoice?: 'auto' | 'none' | 'required';
  responseFormat?: 'text' | 'json';
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
  toolCalls?: ToolCall[];
  finishReason?: 'stop' | 'tool_calls' | 'length' | 'content_filter';
}

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow: number;
  description?: string;
  supportsTools?: boolean;
  isFree?: boolean;
}

export interface ModelProvider {
  name: ProviderName;
  isAvailable(): boolean;
  getModels(): ModelInfo[];
  generateCompletion(messages: ChatMessage[], options?: CompletionOptions): Promise<CompletionResult>;
  generateEmbedding(text: string): Promise<number[]>;
}

// ── Key Health Tracking ───────────────────────────────────────────────
// Shared across all providers for rate-limit-aware fallback.

export interface KeyHealth {
  key: string;
  provider: ProviderName;
  baseUrl: string;
  model: string;
  cooldownUntil: number;       // epoch ms — don't use until this time
  consecutive429s: number;
  failCount: number;
  successCount: number;
  lastUsed: number;
  lastSuccess: number;
  totalCalls: number;
}
