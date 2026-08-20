import { AutomationSchedule, ScheduleId } from './Phase6Types';

/**
 * AutomationSchedules — predefined recurring schedules for CozanetOS (Phase 6).
 *
 * Pre-configured schedules that run automatically:
 *   - Daily: funding scan, security scan, regulatory scan, ecosystem scan, daily brief
 *   - Weekly: competitor report, technology report
 *   - Monthly: progress review
 *
 * Integration point: SchedulerAgent.registerSchedule()
 * Each schedule fires an agent task that feeds into the CozanetRadar or DailyBriefGenerator.
 */
export class AutomationSchedules {
  private schedules: Map<ScheduleId, AutomationSchedule> = new Map();

  constructor() {
    this.defineSchedules();
  }

  // ── Get all schedules ─────────────────────────────────────────────
  getAll(): AutomationSchedule[] {
    return Array.from(this.schedules.values());
  }

  getEnabled(): AutomationSchedule[] {
    return this.getAll().filter(s => s.enabled);
  }

  get(id: ScheduleId): AutomationSchedule | null {
    return this.schedules.get(id) ?? null;
  }

  enable(id: ScheduleId): void {
    const s = this.schedules.get(id);
    if (s) s.enabled = true;
  }

  disable(id: ScheduleId): void {
    const s = this.schedules.get(id);
    if (s) s.enabled = false;
  }

  toggle(id: ScheduleId): void {
    const s = this.schedules.get(id);
    if (s) s.enabled = !s.enabled;
  }

  updateLastRun(id: ScheduleId, timestamp: number): void {
    const s = this.schedules.get(id);
    if (s) {
      s.lastRun = timestamp;
      s.nextRun = this.computeNextRun(s.cron);
    }
  }

  // ── Get schedules by frequency ────────────────────────────────────
  getDailySchedules(): AutomationSchedule[] {
    return this.getAll().filter(s => s.enabled && s.id.startsWith('daily_'));
  }

  getWeeklySchedules(): AutomationSchedule[] {
    return this.getAll().filter(s => s.enabled && s.id.startsWith('weekly_'));
  }

  getMonthlySchedules(): AutomationSchedule[] {
    return this.getAll().filter(s => s.enabled && s.id.startsWith('monthly_'));
  }

  // ── Stats ─────────────────────────────────────────────────────────
  getStats() {
    const all = this.getAll();
    return {
      total: all.length,
      enabled: all.filter(s => s.enabled).length,
      disabled: all.filter(s => !s.enabled).length,
      daily: all.filter(s => s.id.startsWith('daily_')).length,
      weekly: all.filter(s => s.id.startsWith('weekly_')).length,
      monthly: all.filter(s => s.id.startsWith('monthly_')).length,
    };
  }

  // ── Predefined schedules ──────────────────────────────────────────
  private defineSchedules(): void {
    // ── Daily schedules ─────────────────────────────────────────────

    this.schedules.set('daily_funding_scan', {
      id: 'daily_funding_scan',
      name: 'Daily Funding Scan',
      description: 'Search for new grants, hackathons, accelerators, and ecosystem funding opportunities',
      cron: '0 9 * * *',  // 9:00 AM daily
      agentId: 'agent:research',
      taskType: 'funding_scan',
      input: { sources: ['bnb_chain', 'stellar', 'africa_startup', 'ai_programs', 'fintech_programs'] },
      enabled: true,
    });

    this.schedules.set('daily_security_scan', {
      id: 'daily_security_scan',
      name: 'Daily Security Scan',
      description: 'Scan dependencies, repos, and advisories for new vulnerabilities and exposed secrets',
      cron: '0 6 * * *',  // 6:00 AM daily
      agentId: 'agent:security',
      taskType: 'security_scan',
      input: { checkDeps: true, checkRepos: true, checkAdvisories: true },
      enabled: true,
    });

    this.schedules.set('daily_regulatory_scan', {
      id: 'daily_regulatory_scan',
      name: 'Daily Regulatory Scan',
      description: 'Monitor for financial, crypto, and payment regulatory changes (Nigeria + international)',
      cron: '0 7 * * *',  // 7:00 AM daily
      agentId: 'agent:research',
      taskType: 'regulatory_scan',
      input: { jurisdictions: ['Nigeria', 'EU', 'US'], categories: ['crypto', 'payment', 'banking'] },
      enabled: true,
    });

    this.schedules.set('daily_ecosystem_scan', {
      id: 'daily_ecosystem_scan',
      name: 'Daily Ecosystem Scan',
      description: 'Monitor BNB Chain, Stellar/Soroban, and Web3 ecosystems for updates and opportunities',
      cron: '0 8 * * *',  // 8:00 AM daily
      agentId: 'agent:research',
      taskType: 'ecosystem_scan',
      input: { ecosystems: ['BNB Chain', 'Stellar', 'Soroban'], types: ['builder_program', 'grant', 'upgrade', 'partnership'] },
      enabled: true,
    });

    this.schedules.set('daily_brief', {
      id: 'daily_brief',
      name: 'Daily Intelligence Brief',
      description: 'Generate and deliver the Cozanet Daily Intelligence report',
      cron: '30 8 * * *',  // 8:30 AM daily
      agentId: 'agent:automation',
      taskType: 'generate_brief',
      input: { deliverTo: 'agent:email', format: 'text' },
      enabled: true,
    });

    // ── Weekly schedules ────────────────────────────────────────────

    this.schedules.set('weekly_competitor_report', {
      id: 'weekly_competitor_report',
      name: 'Weekly Competitor Report',
      description: 'Deep dive on competitor movements, new products, funding, and pricing changes',
      cron: '0 10 * * 1',  // 10:00 AM every Monday
      agentId: 'agent:research',
      taskType: 'competitor_report',
      input: { competitors: [], depth: 'full' },
      enabled: true,
    });

    this.schedules.set('weekly_technology_report', {
      id: 'weekly_technology_report',
      name: 'Weekly Technology Report',
      description: 'Evaluate new technologies and tools for Cozanet/AEGIS improvement',
      cron: '0 10 * * 3',  // 10:00 AM every Wednesday
      agentId: 'agent:research',
      taskType: 'technology_report',
      input: { categories: ['AI', 'payment', 'blockchain', 'security', 'opensource'] },
      enabled: true,
    });

    // ── Monthly schedules ────────────────────────────────────────────

    this.schedules.set('monthly_progress_review', {
      id: 'monthly_progress_review',
      name: 'Monthly Progress Review',
      description: 'Review project progress, milestone status, and KPI achievement',
      cron: '0 10 1 * *',  // 10:00 AM on the 1st of every month
      agentId: 'agent:ceo',
      taskType: 'progress_review',
      input: { projects: ['AEGIS', 'CozanetOS', 'Cozanet AI'], depth: 'full' },
      enabled: true,
    });
  }

  // ── Simple cron next-run estimator (placeholder) ──────────────────
  private computeNextRun(cron: string): number {
    // Simple: just return now + 24h for daily, + 7d for weekly, + 30d for monthly
    // Real implementation would use a cron parser
    const now = Date.now();
    if (cron.includes('* * *')) return now + 86400000;      // daily
    if (cron.includes('* * 1') || cron.includes('* * 3')) return now + 604800000; // weekly
    if (cron.includes('1 * *')) return now + 2592000000;    // monthly
    return now + 86400000; // default daily
  }
}
