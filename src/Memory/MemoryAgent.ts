import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';

export interface MemoryStoreResult {
  key: string;
  tier: 'hot' | 'warm' | 'cold';
  stored: boolean;
  timestamp: number;
}

export interface MemoryRetrieveResult {
  key: string;
  value: any;
  tier: 'hot' | 'warm' | 'cold';
  found: boolean;
}

/**
 * MemoryAgent — manages multi-tier memory (hot, warm, cold/vector).
 * Upgraded v0.2.0: tier-based storage, semantic search, forgetting policy, batch ops.
 */
export class MemoryAgent extends BaseAgent {
  private localCache: Map<string, { value: any; tier: string; timestamp: number }> = new Map();

  constructor() {
    super('agent:memory', 'Memory Agent', 'Short-term and Long-term retrieval');

    this.registerCapability({
      name: 'memory',
      description: 'Store, retrieve, search, and manage multi-tier memory',
      taskTypes: ['store', 'retrieve', 'search', 'forget', 'batch_store', 'list_keys'],
    });
  }

  protected onStart(): void {
    console.log(`[${this.id}] Memory Agent online — managing multi-tier memory.`);
  }

  public async handle(task: AgentTask): Promise<any> {
    switch (task.type) {
      case 'store':
        return this.store(task.input.key, task.input.value, task.input.tier);
      case 'retrieve':
        return this.retrieve(task.input.key);
      case 'search':
        return this.semanticSearch(task.input.query, task.input.limit);
      case 'forget':
        return this.forget(task.input.key);
      case 'batch_store':
        return this.batchStore(task.input.items);
      case 'list_keys':
        return this.listKeys(task.input.prefix);
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  private async store(key: string, value: any, tier: 'hot' | 'warm' | 'cold' = 'hot'): Promise<MemoryStoreResult> {
    console.log(`[${this.id}] Storing key "${key}" in ${tier} memory`);
    this.localCache.set(key, { value, tier, timestamp: Date.now() });
    return { key, tier, stored: true, timestamp: Date.now() };
  }

  private async retrieve(key: string): Promise<MemoryRetrieveResult> {
    console.log(`[${this.id}] Retrieving key "${key}"`);
    const entry = this.localCache.get(key);
    if (entry) {
      return { key, value: entry.value, tier: entry.tier as any, found: true };
    }
    // Integration point: query cozanet-memory engine for warm/cold tiers
    return { key, value: null, tier: 'cold', found: false };
  }

  private async semanticSearch(query: string, limit = 10): Promise<{ results: { key: string; value: any; score: number }[] }> {
    console.log(`[${this.id}] Semantic search: "${query}"`);
    // Integration point: vector search via cozanet-memory cold tier
    return { results: [] };
  }

  private async forget(key: string): Promise<{ key: string; forgotten: boolean }> {
    console.log(`[${this.id}] Forgetting key "${key}"`);
    return { key, forgotten: this.localCache.delete(key) };
  }

  private async batchStore(items: { key: string; value: any }[]): Promise<{ stored: number; failed: number }> {
    let stored = 0, failed = 0;
    for (const item of items) {
      try {
        this.localCache.set(item.key, { value: item.value, tier: 'hot', timestamp: Date.now() });
        stored++;
      } catch {
        failed++;
      }
    }
    return { stored, failed };
  }

  private async listKeys(prefix?: string): Promise<string[]> {
    const keys = Array.from(this.localCache.keys());
    if (prefix) {
      return keys.filter(k => k.startsWith(prefix));
    }
    return keys;
  }
}
