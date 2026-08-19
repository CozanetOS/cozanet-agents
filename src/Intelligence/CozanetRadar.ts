import {
  RadarFinding, RadarType, FundingOpportunity, CompetitorInfo,
  TechnologyEntry, RegulatoryUpdate, SecurityAdvisory, EcosystemUpdate,
  RegulatoryLevel, Severity,
} from './types';

/**
 * CozanetRadar — Company Radar system (Section 12).
 *
 * 7 radars:
 *   Funding — grants, hackathons, accelerators, African startup programs
 *   Competitor — competitors, new products, funding, launches, pricing
 *   Technology — APIs, payment rails, blockchain infra, AI models (Section 16)
 *   Regulatory — financial rules, crypto rules, cross-border changes (Section 17)
 *   Security — CVEs, dependency vulnerabilities, exposed secrets (Section 18)
 *   Ecosystem — BNB Chain, Stellar/Soroban, builder programs, partner opportunities
 *   Product — user problems, market gaps, competitor gaps, missing capabilities
 *
 * Integration point: web_search, GitHub advisories API, RSS feeds.
 * Radars store findings and provide query/filter APIs.
 */
export class CozanetRadar {
  private findings: Map<string, RadarFinding> = new Map();
  private funding: Map<string, FundingOpportunity> = new Map();
  private competitors: Map<string, CompetitorInfo> = new Map();
  private technologies: Map<string, TechnologyEntry> = new Map();
  private regulatory: Map<string, RegulatoryUpdate> = new Map();
  private security: Map<string, SecurityAdvisory> = new Map();
  private ecosystems: Map<string, EcosystemUpdate> = new Map();

  private listeners: ((finding: RadarFinding) => void)[] = [];
  private alertThreshold: Severity = 'high';

  // ── Add findings ──────────────────────────────────────────────────

  addFinding(finding: RadarFinding): void {
    this.findings.set(finding.id, finding);

    // Route to the appropriate sub-radar
    switch (finding.radar) {
      case 'funding':
        // Funding findings are stored in the funding map separately
        break;
      case 'competitor':
      case 'technology':
      case 'product':
        // Stored in findings map
        break;
    }

    // Alert if severity meets threshold
    if (this.meetsThreshold(finding.severity)) {
      for (const listener of this.listeners) {
        listener(finding);
      }
    }
  }

  addFundingOpp(opportunity: FundingOpportunity): void {
    this.funding.set(opportunity.id, opportunity);
    this.addFinding({
      id: `radar:funding:${opportunity.id}`,
      radar: 'funding',
      title: opportunity.name,
      description: `${opportunity.type} from ${opportunity.provider}${opportunity.amount ? ` — ${opportunity.currency ?? ''}${opportunity.amount}` : ''}`,
      url: opportunity.url,
      severity: opportunity.relevance === 'high' ? 'high' : opportunity.relevance === 'medium' ? 'medium' : 'low',
      timestamp: opportunity.discoveredAt,
      tags: [opportunity.type, opportunity.provider],
      metadata: { deadline: opportunity.deadline, eligibility: opportunity.eligibility },
    });
  }

  addCompetitor(comp: CompetitorInfo): void {
    this.competitors.set(comp.id, comp);
  }

  addTechnology(tech: TechnologyEntry): void {
    this.technologies.set(tech.id, tech);
    this.addFinding({
      id: `radar:tech:${tech.id}`,
      radar: 'technology',
      title: tech.name,
      description: tech.description,
      url: tech.url,
      severity: tech.relevance === 'high' ? 'medium' : 'low',
      timestamp: tech.discoveredAt,
      tags: [tech.category, tech.costImpact ?? 'neutral'],
      metadata: { costImpact: tech.costImpact },
    });
  }

  addRegulatoryUpdate(update: RegulatoryUpdate): void {
    this.regulatory.set(update.id, update);

    const severity: Severity = update.impactLevel === 'red' ? 'critical' : update.impactLevel === 'yellow' ? 'medium' : 'info';
    this.addFinding({
      id: `radar:reg:${update.id}`,
      radar: 'regulatory',
      title: update.title,
      description: update.description,
      url: update.url,
      source: update.source,
      severity,
      timestamp: update.discoveredAt,
      tags: [update.jurisdiction, update.category, update.impactLevel],
      metadata: { affectedProducts: update.affectedProducts },
    });
  }

  addSecurityAdvisory(advisory: SecurityAdvisory): void {
    this.security.set(advisory.id, advisory);
    this.addFinding({
      id: `radar:sec:${advisory.id}`,
      radar: 'security',
      title: advisory.title,
      description: advisory.description,
      url: advisory.url,
      severity: advisory.severity,
      timestamp: advisory.discoveredAt,
      tags: [advisory.type, advisory.affectedPackage ?? 'general'],
      metadata: { cveId: advisory.cveId, remediation: advisory.remediation },
    });
  }

  addEcosystemUpdate(update: EcosystemUpdate): void {
    this.ecosystems.set(update.id, update);
    this.addFinding({
      id: `radar:eco:${update.id}`,
      radar: 'ecosystem',
      title: update.title,
      description: update.description,
      url: update.url,
      severity: update.relevance === 'high' ? 'medium' : 'low',
      timestamp: update.discoveredAt,
      tags: [update.ecosystem, update.type],
    });
  }

  // ── Query findings ────────────────────────────────────────────────

  getAllFindings(): RadarFinding[] {
    return Array.from(this.findings.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  getFindingsByRadar(radar: RadarType): RadarFinding[] {
    return this.getAllFindings().filter(f => f.radar === radar);
  }

  getFindingsBySeverity(severity: Severity): RadarFinding[] {
    return this.getAllFindings().filter(f => f.severity === severity);
  }

  getCriticalAlerts(): RadarFinding[] {
    return this.getAllFindings().filter(f =>
      f.severity === 'critical' || f.severity === 'high'
    );
  }

  // ── Sub-radar queries ──────────────────────────────────────────────

  getFundingOpportunities(filter?: { relevance?: string; type?: string }): FundingOpportunity[] {
    let results = Array.from(this.funding.values());
    if (filter?.relevance) results = results.filter(f => f.relevance === filter.relevance);
    if (filter?.type) results = results.filter(f => f.type === filter.type);
    return results.sort((a, b) => {
      // Sort by deadline urgency, then relevance
      const relOrder = { high: 0, medium: 1, low: 2 };
      return relOrder[a.relevance] - relOrder[b.relevance];
    });
  }

  getCompetitors(): CompetitorInfo[] {
    return Array.from(this.competitors.values()).sort((a, b) => b.lastUpdated - a.lastUpdated);
  }

  getTechnologies(filter?: { category?: string; costImpact?: string }): TechnologyEntry[] {
    let results = Array.from(this.technologies.values());
    if (filter?.category) results = results.filter(t => t.category === filter.category);
    if (filter?.costImpact) results = results.filter(t => t.costImpact === filter.costImpact);
    return results.sort((a, b) => b.discoveredAt - a.discoveredAt);
  }

  getRegulatoryUpdates(filter?: { impactLevel?: RegulatoryLevel; jurisdiction?: string }): RegulatoryUpdate[] {
    let results = Array.from(this.regulatory.values());
    if (filter?.impactLevel) results = results.filter(r => r.impactLevel === filter.impactLevel);
    if (filter?.jurisdiction) results = results.filter(r => r.jurisdiction === filter.jurisdiction);
    return results.sort((a, b) => b.discoveredAt - a.discoveredAt);
  }

  getSecurityAdvisories(filter?: { severity?: Severity; type?: string }): SecurityAdvisory[] {
    let results = Array.from(this.security.values());
    if (filter?.severity) results = results.filter(s => s.severity === filter.severity);
    if (filter?.type) results = results.filter(s => s.type === filter.type);
    return results.sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      return order[a.severity] - order[b.severity];
    });
  }

  getEcosystemUpdates(filter?: { ecosystem?: string; type?: string }): EcosystemUpdate[] {
    let results = Array.from(this.ecosystems.values());
    if (filter?.ecosystem) results = results.filter(e => e.ecosystem === filter.ecosystem);
    if (filter?.type) results = results.filter(e => e.type === filter.type);
    return results.sort((a, b) => b.discoveredAt - a.discoveredAt);
  }

  // ── Alert system ──────────────────────────────────────────────────

  onAlert(listener: (finding: RadarFinding) => void): void {
    this.listeners.push(listener);
  }

  setAlertThreshold(severity: Severity): void {
    this.alertThreshold = severity;
  }

  private meetsThreshold(severity: Severity): boolean {
    const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return order[severity] <= order[this.alertThreshold];
  }

  // ── Clear stale findings ──────────────────────────────────────────

  clearStale(maxAgeMs: number): number {
    const now = Date.now();
    let cleared = 0;
    for (const [id, finding] of this.findings) {
      if (now - finding.timestamp > maxAgeMs) {
        this.findings.delete(id);
        cleared++;
      }
    }
    return cleared;
  }

  // ── Stats ──────────────────────────────────────────────────────────

  getStats() {
    return {
      totalFindings: this.findings.size,
      fundingOpportunities: this.funding.size,
      competitors: this.competitors.size,
      technologies: this.technologies.size,
      regulatoryUpdates: this.regulatory.size,
      securityAdvisories: this.security.size,
      ecosystemUpdates: this.ecosystems.size,
      criticalAlerts: this.getCriticalAlerts().length,
    };
  }
}
