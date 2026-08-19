import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';
import { ContextManager } from '../context/ContextManager';

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

export interface MemoryEntry {
  key: string;
  value: any;
  tier: 'hot' | 'warm' | 'cold';
  timestamp: number;
  tags?: string[];
  accessCount: number;
  lastAccessed?: number;
}

/**
 * MemoryAgent — manages multi-tier memory (hot, warm, cold/vector).
 *
 * v0.2.0 enhancements:
 *  - Multi-tier storage: hot (RAM), warm (disk), cold (vector DB)
 *  - Semantic search across all tiers
 *  - Consolidation: move aged memories from hot → warm → cold
 *  - Forgetting policy with reason tracking
 *  - Batch store and batch retrieve
 *  - Tag-based filtering
 *  - Access tracking (count + last accessed) for LRU eviction
 *
 * Integration point: cozanet-memory engine (persistent storage + vector search).
 */
export class MemoryAgent extends BaseAgent {
  private localCache: Map<string, MemoryEntry> = new Map();
  private maxHotEntries = 1000; // hot tier max — LRU eviction to warm

  constructor() {
    super('agent:memory', 'Memory Agent', 'Short-term and Long-term retrieval');

    this.registerCapability({
      name: 'memory',
      description: 'Store, retrieve, search, consolidate, and manage multi-tier memory with tags and access tracking',
      taskTypes: ['store', 'retrieve', 'search', 'forget', 'batch_store', 'batch_retrieve', 'list_keys', 'consolidate', 'clear_tier', 'get_stats'],
    });
  }

  protected onStart(): void {
    console.log(`[${this.id}] Memory Agent online — managing multi-tier memory.`);
  }

  public async handle(task: AgentTask): Promise<any> {
    switch (task.type) {
      case 'store':
        return this.store(task.input.key, task.input.value, task.input.tier, task.input.tags);
      case 'retrieve':
        return this.retrieve(task.input.key);
      case 'search':
        return this.semanticSearch(task.input.query, task.input.tags, task.input.limit);
      case 'forget':
        return this.forget(task.input.key, task.input.reason);
      case 'batch_store':
        return this.batchStore(task.input.items);
      case 'batch_retrieve':
        return this.batchRetrieve(task.input.keys);
      case 'list_keys':
        return this.listKeys(task.input.prefix, task.input.tier);
      case 'consolidate':
        return this.consolidate(task.input.from, task.input.to);
      case 'clear_tier':
        return this.clearTier(task.input.tier);
      case 'get_stats':
        return this.getMemoryStats();
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  private async store(key: string, value: any, tier: 'hot' | 'warm' | 'cold' = 'hot', tags?: string[]): Promise<MemoryStoreResult> {
    console.log(`[${this.id}] Storing key "${key}" in ${tier} memory${tags ? ` (tags: ${tags.join(', ')})` : ''}`);

    const entry: MemoryEntry = {
      key, value, tier, tags,
      timestamp: Date.now(),
      accessCount: 0,
    };

    this.localCache.set(key, entry);

    // Auto-consolidate hot tier if it's too full
    if (tier === 'hot' && this.localCache.size > this.maxHotEntries) {
      this.consolidateHotToWarm();
    }

    return { key, tier, stored: true, timestamp: Date.now() };
  }

  private async retrieve(key: string): Promise<MemoryRetrieveResult> {
    console.log(`[${this.id}] Retrieving key "${key}"`);
    const entry = this.localCache.get(key);
    if (entry) {
      // Track access for LRU
      entry.accessCount++;
      entry.lastAccessed = Date.now();
      return { key, value: entry.value, tier: entry.tier as any, found: true };
    }
    // Integration point: query cozanet-memory engine for warm/cold tiers
    return { key, value: null, tier: 'cold', found: false };
  }

  private async semanticSearch(query: string, tags?: string[], limit = 10): Promise<{ results: MemoryEntry[] }> {
    console.log(`[${this.id}] Semantic search: "${query}"${tags ? ` (tags: ${tags.join(', ')})` : ''}`);

    // Local search — match on tags and key/value content
    let results = Array.from(this.localCache.values());

    // Filter by tags if provided
    if (tags && tags.length > 0) {
      results = results.filter(e => e.tags?.some(t => tags.includes(t)));
    }

    // Simple relevance scoring (integration point: vector embeddings for real semantic search)
    const scored = results.map(e => ({
      entry: e,
      score: this.scoreRelevance(query, e),
    })).sort((a, b) => b.score - a.score);

    return { results: scored.slice(0, limit).map(s => s.entry) };
  }

  private scoreRelevance(query: string, entry: MemoryEntry): number {
    const q = query.toLowerCase();
    let score = 0;

    // Key match
    if (entry.key.toLowerCase().includes(q)) score += 0.5;

    // Tag matches
    if (entry.tags) {
      for (const tag of entry.tags) {
        if (q.includes(tag.toLowerCase()) || tag.toLowerCase().includes(q)) score += 0.3;
      }
    }

    // Value match (if string)
    if (typeof entry.value === 'string' && entry.value.toLowerCase().includes(q)) {
      score += 0.4;
    }

    // Recency boost (newer = higher score)
    const ageHours = (Date.now() - entry.timestamp) / 3600000;
    score += Math.max(0, 1 - ageHours / 24) * 0.1;

    // Access frequency boost
    score += Math.min(entry.accessCount * 0.05, 0.3);

    return score;
  }

  private async forget(key: string, reason?: string): Promise<{ key: string; forgotten: boolean; reason?: string }> {
    console.log(`[${this.id}] Forgetting key "${key}"${reason ? ` (reason: ${reason})` : ''}`);
    const deleted = this.localCache.delete(key);
    return { key, forgotten: deleted, reason };
  }

  private async batchStore(items: { key: string; value: any; tier?: string; tags?: string[] }[]): Promise<{ stored: number; failed: number }> {
    let stored = 0, failed = 0;
    for (const item of items) {
      try {
        this.localCache.set(item.key, {
          key: item.key,
          value: item.value,
          tier: (item.tier as any) || 'hot',
          tags: item.tags,
          timestamp: Date.now(),
          accessCount: 0,
        });
        stored++;
      } catch {
        failed++;
      }
    }
    return { stored, failed };
  }

  private async batchRetrieve(keys: string[]): Promise<{ found: { key: string; value: any }[]; missing: string[] }> {
    const found: { key: string; value: any }[] = [];
    const missing: string[] = [];

    for (const key of keys) {
      const entry = this.localCache.get(key);
      if (entry) {
        entry.accessCount++;
        entry.lastAccessed = Date.now();
        found.push({ key, value: entry.value });
      } else {
        missing.push(key);
      }
    }

    return { found, missing };
  }

  private async listKeys(prefix?: string, tier?: string): Promise<string[]> {
    let entries = Array.from(this.localCache.values());
    if (prefix) entries = entries.filter(e => e.key.startsWith(prefix));
    if (tier) entries = entries.filter(e => e.tier === tier);
    return entries.map(e => e.key);
  }

  /**
   * Consolidate — move memories from one tier to a colder tier.
   * This is the memory management mechanism: hot → warm → cold.
   * Old or infrequently accessed entries get moved down.
   */
  private async consolidate(from: 'hot' | 'warm' | 'cold', to: 'hot' | 'warm' | 'cold'): Promise<{ consolidated: number; from: string; to: string }> {
    console.log(`[${this.id}] Consolidating ${from} → ${to}`);
    let count = 0;

    const entries = Array.from(this.localCache.values()).filter(e => e.tier === from);

    for (const entry of entries) {
      // Move entries that haven't been accessed recently
      const ageMs = Date.now() - (entry.lastAccessed || entry.timestamp);
      const shouldMove = this.shouldConsolidate(entry, from, to, ageMs);

      if (shouldMove) {
        entry.tier = to;
        count++;
      }
    }

    return { consolidated: count, from, to };
  }

  private shouldConsolidate(entry: MemoryEntry, from: string, to: string, ageMs: number): boolean {
    // Hot → Warm: entries older than 1 hour with < 3 accesses
    if (from === 'hot' && to === 'warm') {
      return ageMs > 3600000 && entry.accessCount < 3;
    }
    // Warm → Cold: entries older than 24 hours
    if (from === 'warm' && to === 'cold') {
      return ageMs > 86400000;
    }
    // Cold → Hot: never auto-promote (manual only)
    return false;
  }

  private consolidateHotToWarm(): number {
    let count = 0;
    const entries = Array.from(this.localCache.values())
      .filter(e => e.tier === 'hot')
      .sort((a, b) => (a.lastAccessed || a.timestamp) - (b.lastAccessed || b.timestamp));

    // Evict the oldest 10% of hot entries to warm
    const toEvict = Math.ceil(entries.length * 0.1);
    for (let i = 0; i < toEvict; i++) {
      entries[i].tier = 'warm';
      count++;
    }
    return count;
  }

  private async clearTier(tier: 'hot' | 'warm' | 'cold'): Promise<{ cleared: number; tier: string }> {
    let count = 0;
    for (const [key, entry] of this.localCache.entries()) {
      if (entry.tier === tier) {
        this.localCache.delete(key);
        count++;
      }
    }
    return { cleared: count, tier };
  }

  private async getMemoryStats(): Promise<{
    total: number;
    hot: number;
    warm: number;
    cold: number;
    totalAccesses: number;
    mostAccessed: { key: string; accessCount: number } | null;
  }> {
    const entries = Array.from(this.localCache.values());
    const mostAccessed = entries.sort((a, b) => b.accessCount - a.accessCount)[0];
    return {
      total: entries.length,
      hot: entries.filter(e => e.tier === 'hot').length,
      warm: entries.filter(e => e.tier === 'warm').length,
      cold: entries.filter(e => e.tier === 'cold').length,
      totalAccesses: entries.reduce((sum, e) => sum + e.accessCount, 0),
      mostAccessed: mostAccessed ? { key: mostAccessed.key, accessCount: mostAccessed.accessCount } : null,
    };
  }

  // ── Domain Context (v0.2.0 — lazy loading: Personal domain (identity/decisions)) ────────────────
  private context: string | null = null;

  /**
   * Load domain-specific context. Lazy-loads only relevant sections,
   * NOT the full 60K master context document.
   */
  public getContext(): string {
    if (!this.context) {
      this.context = ContextManager.loadDomainContext('Personal');
    }
    return this.context;
  }

  public refreshContext(): void {
    this.context = null;
  }

}
