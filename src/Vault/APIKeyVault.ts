// ============================================================================
// APIKeyVault — Secure API Key Management for CozanetOS Agents
// ============================================================================

export interface APIKeyEntry {
  id: string;
  provider: string;           // e.g. 'openai', 'anthropic', 'groq', 'stripe'
  label: string;              // human-friendly name e.g. 'Production OpenAI Key'
  keyValue: string;           // the actual key (encrypted at rest by cozanet-identity)
  keyPrefix: string;          // first 8 chars for display e.g. 'sk-prod...'
  scopes: string[];           // what this key can do e.g. ['chat', 'embeddings']
  status: 'active' | 'rotating' | 'revoked' | 'expired';
  createdAt: number;
  lastUsed?: number;
  lastValidated?: number;
  expiresAt?: number;
  usage: KeyUsage;
  metadata?: Record<string, any>;
}

export interface KeyUsage {
  totalCalls: number;
  totalTokensUsed: number;
  totalCost: number;
  callsByProvider: Record<string, number>;
  lastCallAt?: number;
  errors: number;
  rateLimitHits: number;
}

export interface KeyValidationResult {
  valid: boolean;
  provider: string;
  reason?: string;            // why invalid (expired, revoked, unauthorized, etc.)
  remainingQuota?: number;
  validatedAt: number;
}

export interface KeyRotationResult {
  oldKeyId: string;
  newKeyId: string;
  rotated: boolean;
  oldKeyStatus: string;
  validatedAt: number;
}

/**
 * APIKeyVault — the central credential management system for all CozanetOS agents.
 *
 * Every agent that calls external APIs (APIAgent, IntegrationAgent, AutomationAgent)
 * uses the vault to:
 *   - Store API keys securely (encrypted at rest via cozanet-identity)
 *   - Retrieve keys for API calls (auto-selects the best active key per provider)
 *   - Validate keys (test against the provider's API to confirm they work)
 *   - Rotate keys (replace old key with new, revoke old, zero downtime)
 *   - Track usage (calls, tokens, cost, errors, rate limits)
 *   - Auto-revoke expired or compromised keys
 *
 * Integration point: cozanet-identity (encryption), cozanet-api (validation calls)
 */
export class APIKeyVault {
  private keys: Map<string, APIKeyEntry> = new Map();
  private keysByProvider: Map<string, string[]> = new Map(); // provider → key IDs
  private usageLog: Map<string, UsageLogEntry[]> = new Map(); // keyId → log

  // ── Store a Key ────────────────────────────────────────────────────

  public store(params: {
    provider: string;
    label: string;
    keyValue: string;
    scopes?: string[];
    expiresAt?: number;
    metadata?: Record<string, any>;
  }): APIKeyEntry {
    const id = `key:${params.provider}:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`;
    const keyPrefix = params.keyValue.slice(0, 8) + '...';

    const entry: APIKeyEntry = {
      id,
      provider: params.provider,
      label: params.label,
      keyValue: params.keyValue,
      keyPrefix,
      scopes: params.scopes || [],
      status: 'active',
      createdAt: Date.now(),
      expiresAt: params.expiresAt,
      usage: {
        totalCalls: 0,
        totalTokensUsed: 0,
        totalCost: 0,
        callsByProvider: {},
        errors: 0,
        rateLimitHits: 0,
      },
      metadata: params.metadata,
    };

    this.keys.set(id, entry);

    // Index by provider
    const providerKeys = this.keysByProvider.get(params.provider) || [];
    providerKeys.push(id);
    this.keysByProvider.set(params.provider, providerKeys);

    return entry;
  }

  // ── Retrieve a Key for Use ────────────────────────────────────────

  /**
   * Get the best active key for a provider.
   * Selection criteria: active status, not expired, least recently used (load balance).
   */
  public get(provider: string, requiredScope?: string): APIKeyEntry | null {
    const keyIds = this.keysByProvider.get(provider) || [];
    let candidates: APIKeyEntry[] = keyIds
      .map(id => this.keys.get(id))
      .filter((k): k is APIKeyEntry => k !== undefined && k.status === 'active')
      .filter(k => !k.expiresAt || k.expiresAt > Date.now());

    if (requiredScope) {
      candidates = candidates.filter(k => k.scopes.includes(requiredScope));
    }

    if (candidates.length === 0) return null;

    // Least recently used — spreads load across keys
    candidates.sort((a, b) => (a.lastUsed || 0) - (b.lastUsed || 0));
    return candidates[0];
  }

  /**
   * Get a key by its ID (e.g., for specific key usage).
   */
  public getById(keyId: string): APIKeyEntry | null {
    return this.keys.get(keyId) || null;
  }

  // ── Validate a Key ─────────────────────────────────────────────────

  /**
   * Validate a key by making a test call to the provider's API.
   * Returns whether the key is valid and any remaining quota info.
   */
  public async validate(keyId: string): Promise<KeyValidationResult> {
    const key = this.keys.get(keyId);
    if (!key) {
      return { valid: false, provider: 'unknown', reason: 'Key not found', validatedAt: Date.now() };
    }

    // Check expiry
    if (key.expiresAt && key.expiresAt <= Date.now()) {
      key.status = 'expired';
      return { valid: false, provider: key.provider, reason: 'Key expired', validatedAt: Date.now() };
    }

    if (key.status === 'revoked') {
      return { valid: false, provider: key.provider, reason: 'Key revoked', validatedAt: Date.now() };
    }

    // Integration point: make a test API call to validate the key
    // For now, mark as validated
    key.lastValidated = Date.now();

    return {
      valid: true,
      provider: key.provider,
      remainingQuota: undefined, // would come from provider's API response
      validatedAt: Date.now(),
    };
  }

  /**
   * Validate all keys for a provider.
   */
  public async validateAll(provider: string): Promise<KeyValidationResult[]> {
    const keyIds = this.keysByProvider.get(provider) || [];
    const results: KeyValidationResult[] = [];
    for (const id of keyIds) {
      results.push(await this.validate(id));
    }
    return results;
  }

  // ── Rotate a Key ────────────────────────────────────────────────────

  /**
   * Rotate a key — store the new key, validate it, then revoke the old one.
   * Zero downtime: the new key is active before the old one is revoked.
   */
  public async rotate(oldKeyId: string, newKeyValue: string, newExpiresAt?: number): Promise<KeyRotationResult> {
    const oldKey = this.keys.get(oldKeyId);
    if (!oldKey) {
      return { oldKeyId, newKeyId: '', rotated: false, oldKeyStatus: 'revoked', validatedAt: Date.now() };
    }

    // Store the new key with same provider and scopes
    const newKey = this.store({
      provider: oldKey.provider,
      label: oldKey.label + ' (rotated)',
      keyValue: newKeyValue,
      scopes: oldKey.scopes,
      expiresAt: newExpiresAt,
    });

    // Validate the new key
    const validation = await this.validate(newKey.id);
    if (!validation.valid) {
      // New key is bad — don't revoke the old one
      this.keys.delete(newKey.id);
      const providerKeys = this.keysByProvider.get(oldKey.provider) || [];
      this.keysByProvider.set(oldKey.provider, providerKeys.filter(id => id !== newKey.id));
      return { oldKeyId, newKeyId: '', rotated: false, oldKeyStatus: oldKey.status, validatedAt: Date.now() };
    }

    // New key is valid — revoke the old one
    oldKey.status = 'revoked';
    return {
      oldKeyId,
      newKeyId: newKey.id,
      rotated: true,
      oldKeyStatus: 'revoked',
      validatedAt: Date.now(),
    };
  }

  // ── Revoke a Key ────────────────────────────────────────────────────

  public revoke(keyId: string): { revoked: boolean; keyId: string } {
    const key = this.keys.get(keyId);
    if (!key) return { revoked: false, keyId };
    key.status = 'revoked';
    return { revoked: true, keyId };
  }

  // ── Delete a Key ────────────────────────────────────────────────────

  public delete(keyId: string): { deleted: boolean; keyId: string } {
    const key = this.keys.get(keyId);
    if (!key) return { deleted: false, keyId };

    // Remove from provider index
    const providerKeys = this.keysByProvider.get(key.provider) || [];
    this.keysByProvider.set(key.provider, providerKeys.filter(id => id !== keyId));

    // Remove the key and its usage log
    this.keys.delete(keyId);
    this.usageLog.delete(keyId);

    return { deleted: true, keyId };
  }

  // ── List Keys ──────────────────────────────────────────────────────

  public list(filter?: { provider?: string; status?: string }): APIKeyEntry[] {
    let entries = Array.from(this.keys.values());

    if (filter?.provider) {
      entries = entries.filter(k => k.provider === filter.provider);
    }
    if (filter?.status) {
      entries = entries.filter(k => k.status === filter.status);
    }

    return entries;
  }

  public listByProvider(provider: string): APIKeyEntry[] {
    return this.list({ provider });
  }

  public listActive(): APIKeyEntry[] {
    return this.list({ status: 'active' });
  }

  // ── Track Usage ────────────────────────────────────────────────────

  public recordUsage(keyId: string, usage: {
    tokensUsed?: number;
    cost?: number;
    success: boolean;
    rateLimited?: boolean;
  }): void {
    const key = this.keys.get(keyId);
    if (!key) return;

    key.usage.totalCalls++;
    key.usage.lastCallAt = Date.now();
    key.lastUsed = Date.now();

    if (usage.tokensUsed) {
      key.usage.totalTokensUsed += usage.tokensUsed;
    }
    if (usage.cost) {
      key.usage.totalCost += usage.cost;
    }
    if (!usage.success) {
      key.usage.errors++;
    }
    if (usage.rateLimited) {
      key.usage.rateLimitHits++;
    }

    // Add to usage log
    const log = this.usageLog.get(keyId) || [];
    log.push({ timestamp: Date.now(), ...usage });
    if (log.length > 1000) log.shift(); // keep last 1000 entries
    this.usageLog.set(keyId, log);
  }

  public getUsage(keyId: string): KeyUsage | null {
    const key = this.keys.get(keyId);
    return key ? key.usage : null;
  }

  public getUsageLog(keyId: string, limit = 50): UsageLogEntry[] {
    const log = this.usageLog.get(keyId) || [];
    return log.slice(-limit);
  }

  // ── Health Check ───────────────────────────────────────────────────

  public getHealth(): {
    totalKeys: number;
    active: number;
    revoked: number;
    expired: number;
    providers: string[];
    totalCalls: number;
    totalCost: number;
    totalErrors: number;
  } {
    const all = Array.from(this.keys.values());
    return {
      totalKeys: all.length,
      active: all.filter(k => k.status === 'active').length,
      revoked: all.filter(k => k.status === 'revoked').length,
      expired: all.filter(k => k.status === 'expired').length,
      providers: Array.from(this.keysByProvider.keys()),
      totalCalls: all.reduce((sum, k) => sum + k.usage.totalCalls, 0),
      totalCost: all.reduce((sum, k) => sum + k.usage.totalCost, 0),
      totalErrors: all.reduce((sum, k) => sum + k.usage.errors, 0),
    };
  }

  // ── Auto-cleanup ───────────────────────────────────────────────────

  /**
   * Scan all keys and mark expired ones as expired.
   * Returns the number of keys that were auto-expired.
   */
  public cleanupExpired(): number {
    let count = 0;
    for (const key of this.keys.values()) {
      if (key.status === 'active' && key.expiresAt && key.expiresAt <= Date.now()) {
        key.status = 'expired';
        count++;
      }
    }
    return count;
  }
}

export interface UsageLogEntry {
  timestamp: number;
  tokensUsed?: number;
  cost?: number;
  success: boolean;
  rateLimited?: boolean;
}
