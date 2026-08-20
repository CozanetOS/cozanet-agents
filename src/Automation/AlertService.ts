import { Alert, AlertChannel } from './Phase6Types';
import { RadarFinding } from '../Intelligence/types';

/**
 * AlertService — push critical alerts to CozyCrypto (Section 18 + Phase 6).
 *
 * "Critical security findings should alert immediately."
 * "Suppress low-value noise." (Section 97, rule 15)
 *
 * Alert channels: console, email, whatsapp, telegram, dashboard.
 * Integration point: wire to actual notification services when available.
 */
export class AlertService {
  private alerts: Map<string, Alert> = new Map();
  private channels: Set<AlertChannel> = new Set(['console']);
  private handlers: Map<AlertChannel, (alert: Alert) => void> = new Map();

  // ── Configuration ──────────────────────────────────────────────────

  enableChannel(channel: AlertChannel, handler?: (alert: Alert) => void): void {
    this.channels.add(channel);
    if (handler) {
      this.handlers.set(channel, handler);
    }
  }

  disableChannel(channel: AlertChannel): void {
    this.channels.delete(channel);
  }

  getEnabledChannels(): AlertChannel[] {
    return Array.from(this.channels);
  }

  // ── Create and dispatch alerts ────────────────────────────────────

  alert(
    title: string,
    message: string,
    severity: Alert['severity'],
    category: string,
    channels?: AlertChannel[],
  ): Alert {
    const alert: Alert = {
      id: `alert:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
      title,
      message,
      severity,
      category,
      channels: channels ?? Array.from(this.channels),
      createdAt: Date.now(),
      acknowledged: false,
    };

    this.alerts.set(alert.id, alert);

    // Dispatch to channels
    const targetChannels = alert.channels;
    for (const ch of targetChannels) {
      const handler = this.handlers.get(ch);
      if (handler) {
        handler(alert);
      } else if (ch === 'console') {
        const icon = severity === 'critical' ? '🚨' : severity === 'high' ? '⚠️' : '📋';
        console.log(`\n${icon} [${severity.toUpperCase()}] ${title}\n   ${message}\n   Category: ${category}\n`);
      }
    }

    return alert;
  }

  // ── Create alert from radar finding ───────────────────────────────

  alertFromFinding(finding: RadarFinding): Alert | null {
    // Suppress low-value noise (Section 97 rule 15)
    if (finding.severity === 'info' || finding.severity === 'low') return null;

    return this.alert(
      finding.title,
      finding.description,
      finding.severity as Alert['severity'],
      finding.radar,
    );
  }

  // ── Acknowledge alerts ────────────────────────────────────────────

  acknowledge(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) alert.acknowledged = true;
  }

  acknowledgeAll(): number {
    let count = 0;
    for (const alert of this.alerts.values()) {
      if (!alert.acknowledged) {
        alert.acknowledged = true;
        count++;
      }
    }
    return count;
  }

  // ── Query alerts ───────────────────────────────────────────────────

  getAlerts(filter?: {
    severity?: string;
    acknowledged?: boolean;
    category?: string;
  }): Alert[] {
    let results = Array.from(this.alerts.values());
    if (filter?.severity) results = results.filter(a => a.severity === filter.severity);
    if (filter?.acknowledged !== undefined) results = results.filter(a => a.acknowledged === filter.acknowledged);
    if (filter?.category) results = results.filter(a => a.category === filter.category);
    return results.sort((a, b) => b.createdAt - a.createdAt);
  }

  getUnacknowledged(): Alert[] {
    return this.getAlerts({ acknowledged: false });
  }

  getCriticalAlerts(): Alert[] {
    return this.getAlerts({ severity: 'critical' });
  }

  // ── Stats ─────────────────────────────────────────────────────────

  getStats() {
    const all = Array.from(this.alerts.values());
    return {
      total: all.length,
      critical: all.filter(a => a.severity === 'critical').length,
      high: all.filter(a => a.severity === 'high').length,
      medium: all.filter(a => a.severity === 'medium').length,
      low: all.filter(a => a.severity === 'low').length,
      unacknowledged: all.filter(a => !a.acknowledged).length,
      channels: this.channels.size,
    };
  }

  // ── Clear old alerts ──────────────────────────────────────────────

  clearAcknowledged(maxAgeMs: number): number {
    const now = Date.now();
    let cleared = 0;
    for (const [id, alert] of this.alerts) {
      if (alert.acknowledged && now - alert.createdAt > maxAgeMs) {
        this.alerts.delete(id);
        cleared++;
      }
    }
    return cleared;
  }
}
