/**
 * PingScheduler — keeps the agent alive on Vercel free plan.
 *
 * TWO STRATEGIES (both run simultaneously for redundancy):
 *
 * 1. SELF-SCHEDULING (QStash):
 *    After each execution slice, automatically schedule the next ping.
 *    No external service needed. QStash free tier: 500 messages/day.
 *    Good for ~8 hours of continuous agent work per day.
 *
 * 2. EXTERNAL CRON (cron-job.org / UptimeRobot):
 *    A free external service pings /api/heartbeat every 1-2 minutes.
 *    This keeps the Vercel function warm AND resumes any paused tasks.
 *    Even if QStash fails, the cron picks up.
 *
 * 3. KEEP-WARM (optional):
 *    A lightweight ping every 5 min just to prevent Vercel cold starts.
 *    Only useful if you want instant response times — not needed for
 *    background task execution.
 */

export interface PingConfig {
  /** Your deployed heartbeat endpoint URL */
  heartbeatUrl: string;
  /** QStash base URL (https://qstash.upstash.io/v1) */
  qstashUrl?: string;
  /** QStash token */
  qstashToken?: string;
  /** Delay between pings in ms (default: 60000 = 1 min) */
  pingIntervalMs?: number;
  /** Keep-warm interval in ms (default: 300000 = 5 min) */
  keepWarmIntervalMs?: number;
}

export class PingScheduler {
  private config: PingConfig;

  constructor(config: PingConfig) {
    this.config = config;
  }

  /**
   * Schedule a single ping via QStash.
   * Called by KeepAliveManager after each execution slice.
   */
  async schedulePing(delayMs?: number): Promise<boolean> {
    if (!this.config.qstashUrl || !this.config.qstashToken) return false;

    const delay = delayMs ?? this.config.pingIntervalMs ?? 60000;
    const delaySeconds = Math.ceil(delay / 1000);

    try {
      const res = await fetch(
        `${this.config.qstashUrl}/publish/${encodeURIComponent(this.config.heartbeatUrl)}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.qstashToken}`,
            'Content-Type': 'application/json',
            'Delay': `${delaySeconds}s`,
          },
          body: JSON.stringify({ source: 'keepalive-ping' }),
        }
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Schedule a keep-warm ping (just to prevent Vercel cold starts).
   * Lighter frequency — every 5 min.
   */
  async scheduleKeepWarm(): Promise<boolean> {
    if (!this.config.qstashUrl || !this.config.qstashToken) return false;

    const delay = this.config.keepWarmIntervalMs ?? 300000;
    const delaySeconds = Math.ceil(delay / 1000);

    try {
      const res = await fetch(
        `${this.config.qstashUrl}/publish/${encodeURIComponent(this.config.heartbeatUrl)}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.qstashToken}`,
            'Content-Type': 'application/json',
            'Delay': `${delaySeconds}s`,
          },
          body: JSON.stringify({ source: 'keep-warm' }),
        }
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Bootstrap: immediately ping the heartbeat, then schedule the next one.
   * Call this when a long task is first submitted.
   */
  async bootstrap(): Promise<void> {
    // Immediate ping to start processing
    try {
      await fetch(this.config.heartbeatUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'bootstrap' }),
      });
    } catch {
      // Vercel might be cold — the scheduled QStash ping will wake it
    }

    // Schedule follow-up pings
    await this.schedulePing();
  }
}

/**
 * SETUP GUIDE — print this or read the README:
 *
 * 1. Create a free Upstash Redis: https://upstash.com (for checkpoint storage)
 *    → Get UPSTASH_REDIS_URL and UPSTASH_REDIS_TOKEN
 *
 * 2. Create a free QStash (same Upstash account): https://upstash.com/qstash
 *    → Get QSTASH_URL (https://qstash.upstash.io/v1) and QSTASH_TOKEN
 *
 * 3. Deploy heartbeat endpoint to Vercel:
 *    → /api/heartbeat.ts (see HeartbeatHandler docs)
 *    → Set HEARTBEAT_URL env var to the deployed URL
 *
 * 4. (Optional but recommended) Set up cron-job.org as backup:
 *    → Ping https://your-app.vercel.app/api/heartbeat every 1 min
 *
 * 5. Set Vercel env vars:
 *    UPSTASH_REDIS_URL=...
 *    UPSTASH_REDIS_TOKEN=...
 *    QSTASH_URL=https://qstash.upstash.io/v1
 *    QSTASH_TOKEN=...
 *    HEARTBEAT_URL=https://your-app.vercel.app/api/heartbeat
 *    GROQ_API_KEY=... (your primary LLM key)
 */
