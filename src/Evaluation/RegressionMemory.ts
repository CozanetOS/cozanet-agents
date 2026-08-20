import { RegressionEntry } from './Phase7Types';

/**
 * RegressionMemory — Section 87: "When a failure is fixed, the AI should not
 * repeatedly rediscover the same mistake."
 *
 * Pattern: Problem → Cause → Fix → Lesson → Regression test
 *
 * Every time a bug is fixed, a regression entry is created so the system
 * remembers the lesson and can verify the fix doesn't break again.
 */
export class RegressionMemory {
  private entries: Map<string, RegressionEntry> = new Map();

  // ── Record a regression ──────────────────────────────────────────
  record(
    problem: string,
    cause: string,
    fix: string,
    lesson: string,
    regressionTest: string,
  ): RegressionEntry {
    const entry: RegressionEntry = {
      id: `reg:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
      problem, cause, fix, lesson, regressionTest,
      createdAt: Date.now(),
      verifiedCount: 0,
    };
    this.entries.set(entry.id, entry);
    return entry;
  }

  // ── Verify a regression test passes ───────────────────────────────
  verify(id: string): RegressionEntry | null {
    const entry = this.entries.get(id);
    if (entry) {
      entry.lastVerified = Date.now();
      entry.verifiedCount++;
    }
    return entry ?? null;
  }

  // ── Search ────────────────────────────────────────────────────────
  search(query: string): RegressionEntry[] {
    const q = query.toLowerCase();
    return Array.from(this.entries.values()).filter(e =>
      e.problem.toLowerCase().includes(q) ||
      e.cause.toLowerCase().includes(q) ||
      e.lesson.toLowerCase().includes(q) ||
      e.fix.toLowerCase().includes(q)
    );
  }

  // ── Get all entries ───────────────────────────────────────────────
  getAll(): RegressionEntry[] {
    return Array.from(this.entries.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  get(id: string): RegressionEntry | null {
    return this.entries.get(id) ?? null;
  }

  // ── Check if a similar problem was already fixed ─────────────────
  findSimilar(problem: string): RegressionEntry | null {
    const words = problem.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    for (const entry of this.entries.values()) {
      const entryText = `${entry.problem} ${entry.cause}`.toLowerCase();
      const matchCount = words.filter(w => entryText.includes(w)).length;
      if (matchCount >= words.length * 0.5) return entry;
    }
    return null;
  }

  // ── Stats ─────────────────────────────────────────────────────────
  getStats() {
    const all = Array.from(this.entries.values());
    return {
      total: all.length,
      verified: all.filter(e => e.verifiedCount > 0).length,
      unverified: all.filter(e => e.verifiedCount === 0).length,
      totalVerifications: all.reduce((s, e) => s + e.verifiedCount, 0),
    };
  }

  // ── Pre-populate with known Cozanet regressions ───────────────────
  seedKnownRegressions(): void {
    const known: Omit<RegressionEntry, 'id' | 'createdAt' | 'verifiedCount'>[] = [
      {
        problem: 'Supabase service-role key exposed in client-side code',
        cause: 'Service-role key placed in frontend environment variables',
        fix: 'Rotated the key, moved to server-side only, removed from client bundles',
        lesson: 'Never place privileged keys in client-side code. Service-role keys bypass RLS.',
        regressionTest: 'Security scanner flags SUPABASE_SERVICE_ROLE_KEY in .tsx files',
        lastVerified: Date.now(),
      },
      {
        problem: 'Vercel deployment failures due to missing package tokens',
        cause: 'Private npm packages required auth tokens not configured in Vercel',
        fix: 'Added NPM_TOKEN to Vercel environment variables',
        lesson: 'CI/CD environments need their own secret configuration — local env does not transfer.',
        regressionTest: 'Deployment monitor checks for missing token errors in build logs',
        lastVerified: Date.now(),
      },
      {
        problem: 'Fragmented wallet implementations across codebase',
        cause: 'Multiple wallet derivation methods (HMAC, direct, etc.) used in different places',
        fix: 'Consolidated to Vault Engine as single source of truth',
        lesson: 'Architecture is source of truth — when code conflicts with architecture, fix the code.',
        regressionTest: 'Constitution check blocks changes with storesPrivateKeyInClient=true',
        lastVerified: Date.now(),
      },
    ];

    for (const k of known) {
      const entry: RegressionEntry = {
        ...k,
        id: `reg:seed:${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now() - Math.floor(Math.random() * 86400000 * 30),
        verifiedCount: 1,
      };
      this.entries.set(entry.id, entry);
    }
  }
}
