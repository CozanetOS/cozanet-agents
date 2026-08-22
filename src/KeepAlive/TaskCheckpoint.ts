import { TaskCheckpoint as Checkpoint, KeepAliveConfig } from './types';

/**
 * CheckpointStore — persists task checkpoints.
 *
 * Uses Upstash Redis (free tier, 10K commands/day) when KV URL is provided.
 * Falls back to in-memory Map for local dev.
 *
 * Upstash is ideal because:
 *  - Free tier (10K commands/day) is enough for checkpointing
 *  - HTTP-based — works from Vercel serverless without TCP connections
 *  - Global, low-latency
 */
export class CheckpointStore {
  private memory = new Map<string, Checkpoint>();
  private config: KeepAliveConfig;

  constructor(config: KeepAliveConfig) {
    this.config = config;
  }

  /** Save a checkpoint */
  async save(checkpoint: Checkpoint): Promise<void> {
    if (this.config.storage === 'kv' && this.config.kvUrl) {
      await this.kvSet(`checkpoint:${checkpoint.id}`, JSON.stringify(checkpoint));
    } else {
      this.memory.set(checkpoint.id, checkpoint);
    }
  }

  /** Load a checkpoint by ID */
  async load(id: string): Promise<Checkpoint | null> {
    if (this.config.storage === 'kv' && this.config.kvUrl) {
      const raw = await this.kvGet(`checkpoint:${id}`);
      return raw ? JSON.parse(raw) : null;
    }
    return this.memory.get(id) ?? null;
  }

  /** Get all checkpoints that are paused (waiting for resume) */
  async getPaused(): Promise<Checkpoint[]> {
    if (this.config.storage === 'kv' && this.config.kvUrl) {
      // Scan for checkpoint:* keys (Upstash supports SCAN)
      const keys = await this.kvScan('checkpoint:*');
      const results: Checkpoint[] = [];
      for (const key of keys) {
        const raw = await this.kvGet(key);
        if (raw) {
          const cp = JSON.parse(raw) as Checkpoint;
          if (cp.status === 'paused') results.push(cp);
        }
      }
      return results;
    }
    return Array.from(this.memory.values()).filter(c => c.status === 'paused');
  }

  /** Delete a checkpoint (after task completion) */
  async delete(id: string): Promise<void> {
    if (this.config.storage === 'kv' && this.config.kvUrl) {
      await this.kvDel(`checkpoint:${id}`);
    } else {
      this.memory.delete(id);
    }
  }

  // ── Upstash Redis HTTP helpers ──────────────────────────────────────
  private async kvSet(key: string, value: string): Promise<void> {
    const url = `${this.config.kvUrl}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`;
    await fetch(url, {
      headers: { Authorization: `Bearer ${this.config.kvToken}` },
    });
  }

  private async kvGet(key: string): Promise<string | null> {
    const url = `${this.config.kvUrl}/get/${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.config.kvToken}` },
    });
    const data = await res.json();
    return data.result ?? null;
  }

  private async kvDel(key: string): Promise<void> {
    const url = `${this.config.kvUrl}/del/${encodeURIComponent(key)}`;
    await fetch(url, {
      headers: { Authorization: `Bearer ${this.config.kvToken}` },
    });
  }

  private async kvScan(pattern: string): Promise<string[]> {
    // Upstash supports SCAN via /scan/{cursor}?match={pattern}
    const url = `${this.config.kvUrl}/scan/0?match=${encodeURIComponent(pattern)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.config.kvToken}` },
    });
    const data = await res.json();
    return data.result?.[1] ?? [];
  }
}
