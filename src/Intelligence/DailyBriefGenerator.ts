import { CozanetRadar } from './CozanetRadar';
import { DailyBrief, RadarFinding } from './types';

/**
 * DailyBriefGenerator — generates the Cozanet Daily Intelligence report (Section 38).
 *
 * Sections:
 *  1. Critical alerts
 *  2. Funding opportunities
 *  3. Competitive changes
 *  4. Technology changes
 *  5. Regulatory changes
 *  6. Ecosystem updates
 *  7. AEGIS engineering discoveries
 *  8. Product opportunities
 *  9. Recommended actions
 * 10. Items requiring CozyCrypto approval
 *
 * "Do not overwhelm the user."
 */
export class DailyBriefGenerator {
  private radar: CozanetRadar;

  constructor(radar: CozanetRadar) {
    this.radar = radar;
  }

  // ── Generate the daily brief ──────────────────────────────────────
  generate(): DailyBrief {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);

    const criticalAlerts = this.radar.getCriticalAlerts();
    const funding = this.radar.getFundingOpportunities().slice(0, 5); // top 5
    const competitiveFindings = this.radar.getFindingsByRadar('competitor').slice(0, 5);
    const techFindings = this.radar.getFindingsByRadar('technology').slice(0, 5);
    const regulatory = this.radar.getRegulatoryUpdates().slice(0, 5);
    const ecosystem = this.radar.getEcosystemUpdates().slice(0, 5);
    const productOpps = this.radar.getFindingsByRadar('product').slice(0, 5);

    const recommendedActions = this.generateRecommendedActions(criticalAlerts, funding, regulatory);
    const approvalItems = this.generateApprovalItems(criticalAlerts, regulatory);

    return {
      date,
      criticalAlerts,
      fundingOpportunities: funding,
      competitiveChanges: competitiveFindings,
      technologyChanges: techFindings,
      regulatoryChanges: regulatory,
      ecosystemUpdates: ecosystem,
      productOpportunities: productOpps,
      recommendedActions,
      approvalItems,
      generatedAt: Date.now(),
    };
  }

  // ── Format as text (for display) ───────────────────────────────────
  formatText(brief?: DailyBrief): string {
    const b = brief ?? this.generate();
    const lines: string[] = [];

    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push(`  COZANET DAILY INTELLIGENCE — ${b.date}`);
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 1. Critical alerts
    lines.push('\n1. CRITICAL ALERTS');
    if (b.criticalAlerts.length === 0) {
      lines.push('   ✓ No critical alerts');
    } else {
      for (const a of b.criticalAlerts) {
        lines.push(`   [${a.severity.toUpperCase()}] ${a.title}`);
        lines.push(`      ${a.description}`);
      }
    }

    // 2. Funding
    lines.push('\n2. FUNDING OPPORTUNITIES');
    if (b.fundingOpportunities.length === 0) {
      lines.push('   • No new opportunities');
    } else {
      for (const f of b.fundingOpportunities) {
        lines.push(`   • ${f.name} (${f.type} from ${f.provider})`);
        if (f.amount) lines.push(`     Amount: ${f.currency ?? ''}${f.amount}`);
        if (f.deadline) lines.push(`     Deadline: ${f.deadline}`);
        lines.push(`     Relevance: ${f.relevance}`);
      }
    }

    // 3. Competitive
    lines.push('\n3. COMPETITIVE CHANGES');
    if (b.competitiveChanges.length === 0) {
      lines.push('   • No changes detected');
    } else {
      for (const c of b.competitiveChanges) {
        lines.push(`   • ${c.title} — ${c.description}`);
      }
    }

    // 4. Technology
    lines.push('\n4. TECHNOLOGY CHANGES');
    if (b.technologyChanges.length === 0) {
      lines.push('   • No new technology');
    } else {
      for (const t of b.technologyChanges) {
        lines.push(`   • ${t.title} — ${t.description}`);
      }
    }

    // 5. Regulatory
    lines.push('\n5. REGULATORY CHANGES');
    if (b.regulatoryChanges.length === 0) {
      lines.push('   • No regulatory changes');
    } else {
      for (const r of b.regulatoryChanges) {
        const levelIcon = r.impactLevel === 'red' ? '🔴' : r.impactLevel === 'yellow' ? '🟡' : '🟢';
        lines.push(`   ${levelIcon} ${r.title} (${r.jurisdiction})`);
        lines.push(`      ${r.description}`);
      }
    }

    // 6. Ecosystem
    lines.push('\n6. ECOSYSTEM UPDATES');
    if (b.ecosystemUpdates.length === 0) {
      lines.push('   • No updates');
    } else {
      for (const e of b.ecosystemUpdates) {
        lines.push(`   • [${e.ecosystem}] ${e.title} — ${e.description}`);
      }
    }

    // 7. Product
    lines.push('\n7. PRODUCT OPPORTUNITIES');
    if (b.productOpportunities.length === 0) {
      lines.push('   • No new opportunities');
    } else {
      for (const p of b.productOpportunities) {
        lines.push(`   • ${p.title} — ${p.description}`);
      }
    }

    // 9. Recommended actions
    lines.push('\n9. RECOMMENDED ACTIONS');
    if (b.recommendedActions.length === 0) {
      lines.push('   • No actions needed');
    } else {
      b.recommendedActions.forEach((a, i) => lines.push(`   ${i + 1}. ${a}`));
    }

    // 10. Approval items
    lines.push('\n10. ITEMS REQUIRING APPROVAL');
    if (b.approvalItems.length === 0) {
      lines.push('   ✓ Nothing requires approval');
    } else {
      for (const item of b.approvalItems) {
        lines.push(`   ⚠ ${item}`);
      }
    }

    lines.push('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return lines.join('\n');
  }

  // ── Generate recommended actions ──────────────────────────────────
  private generateRecommendedActions(
    critical: RadarFinding[],
    funding: any[],
    regulatory: any[],
  ): string[] {
    const actions: string[] = [];

    // Critical security alerts → immediate action
    const securityAlerts = critical.filter(c => c.radar === 'security');
    for (const alert of securityAlerts) {
      actions.push(`URGENT: Address security alert — ${alert.title}`);
    }

    // Funding with approaching deadlines
    for (const f of funding) {
      if (f.deadline) {
        const deadline = new Date(f.deadline);
        const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / 86400000);
        if (daysLeft <= 7 && daysLeft > 0) {
          actions.push(`Apply to ${f.name} — deadline in ${daysLeft} days (${f.deadline})`);
        }
      }
    }

    // Red regulatory changes → legal review
    const redRegs = regulatory.filter(r => r.impactLevel === 'red');
    for (const r of redRegs) {
      actions.push(`Legal review needed: ${r.title} (${r.jurisdiction})`);
    }

    // If no actions, add a default
    if (actions.length === 0) {
      actions.push('Continue AEGIS MVP development — no urgent actions today');
    }

    return actions;
  }

  // ── Generate approval items ───────────────────────────────────────
  private generateApprovalItems(
    critical: RadarFinding[],
    regulatory: any[],
  ): string[] {
    const items: string[] = [];

    // Critical findings that might need a decision
    const criticalNonSecurity = critical.filter(c => c.radar !== 'security');
    for (const f of criticalNonSecurity) {
      items.push(`${f.title}: ${f.description}`);
    }

    // Red regulatory → needs approval for compliance response
    const redRegs = regulatory.filter(r => r.impactLevel === 'red');
    for (const r of redRegs) {
      items.push(`Regulatory response needed: ${r.title}`);
    }

    return items;
  }
}
