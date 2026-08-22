import { KeepAliveManager } from './KeepAliveManager';
import { HeartbeatResponse } from './types';

/**
 * HeartbeatHandler — the HTTP endpoint that external ping services hit.
 *
 * Deploy this as a Vercel serverless function:
 *
 *   // api/heartbeat.ts (in your Vercel project)
 *   import { HeartbeatHandler } from '@cozanet/agents';
 *   export default async function handler(req, res) {
 *     const result = await HeartbeatHandler.handle();
 *     res.status(200).json(result);
 *   }
 *
 * EXTERNAL PING SETUP (pick one):
 *
 * Option A — cron-job.org (free, simplest):
 *   1. Go to https://cron-job.org
 *   2. Create a job hitting https://your-app.vercel.app/api/heartbeat
 *   3. Set interval to 1 minute
 *
 * Option B — UptimeRobot (free):
 *   1. Go to https://uptimerobot.com
 *   2. Add HTTP monitor for https://your-app.vercel.app/api/heartbeat
 *   3. Set interval to 1 minute
 *
 * Option C — QStash (self-scheduling, no external service needed):
 *   1. Set QSTASH_URL and QSTASH_TOKEN env vars
 *   2. Set HEARTBEAT_URL to your endpoint URL
 *   3. KeepAliveManager will auto-schedule the next ping after each slice
 *
 * The endpoint is idempotent — pinging when there's no work returns 200
 * with hadWork: false and doesn't consume resources.
 */
export class HeartbeatHandler {
  /**
   * Handle a heartbeat request. Returns immediately.
   */
  static async handle(): Promise<HeartbeatResponse> {
    const manager = KeepAliveManager.getInstance();

    try {
      const result = await manager.resumeNext();

      if (!result.hadWork) {
        // No pending work — just a keep-alive ping to keep Vercel warm
        return {
          ...result,
          timestamp: Date.now(),
        };
      }

      return result;
    } catch (err: any) {
      return {
        hadWork: false,
        checkpointId: null,
        completed: false,
        needsAnotherPing: false,
        nextPingDelayMs: 60000,
        pendingCount: 0,
        timestamp: Date.now(),
      };
    }
  }
}
