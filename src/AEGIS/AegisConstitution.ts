import {
  ConstitutionRule, ConstitutionViolation, ProposedChange,
  ConstitutionCheckResult, ConstitutionRuleId,
} from './types';

/**
 * AegisConstitution — the architecture constitution for AEGIS (Section 42).
 *
 * "If a technically functional implementation violates architecture:
 *  'This works technically but conflicts with the current AEGIS architecture because...'
 *  The AI should explain and propose an architecture-compliant solution."
 *
 * 13 rules derived from confirmed architecture decisions and build spec Section 97.
 */
export class AegisConstitution {
  private static instance: AegisConstitution | null = null;
  private rules: ConstitutionRule[];

  private constructor() {
    this.rules = this.defineRules();
  }

  static getInstance(): AegisConstitution {
    if (!AegisConstitution.instance) {
      AegisConstitution.instance = new AegisConstitution();
    }
    return AegisConstitution.instance;
  }

  // ── Check a proposed change against all rules ─────────────────────
  check(change: ProposedChange): ConstitutionCheckResult {
    const violations: ConstitutionViolation[] = [];
    const warnings: string[] = [];

    for (const rule of this.rules) {
      const violation = rule.check(change);
      if (violation) {
        violations.push(violation);
      }
    }

    // Soft warnings
    if (change.hardcodesProviderLockin && !violations.some(v => v.ruleId === 'connect_not_build')) {
      warnings.push('Change may introduce provider lock-in. Consider whether an abstraction layer is more appropriate.');
    }

    if (change.requiresApprovalForExecution && !change.takesCustodyOfFunds) {
      warnings.push('This change requires approval for execution. Ensure the approval workflow is triggered.');
    }

    return {
      passed: violations.length === 0,
      violations: violations.sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2 };
        return order[a.severity] - order[b.severity];
      }),
      warnings,
      checkedAt: Date.now(),
    };
  }

  // ── Get all rules (for display / knowledge) ──────────────────────────
  getRules(): { id: ConstitutionRuleId; title: string; description: string }[] {
    return this.rules.map(r => ({ id: r.id, title: r.title, description: r.description }));
  }

  getRule(id: ConstitutionRuleId): ConstitutionRule | null {
    return this.rules.find(r => r.id === id) ?? null;
  }

  // ── Explain a violation in plain language (Section 42) ──────────────
  explainViolation(violation: ConstitutionViolation): string {
    return `This works technically but conflicts with the current AEGIS architecture because it violates the "${violation.ruleTitle}" rule (${violation.severity} severity). ${violation.message}. Recommendation: ${violation.recommendation}`;
  }

  // ── The 13 constitution rules ───────────────────────────────────────
  private defineRules(): ConstitutionRule[] {
    return [
      {
        id: 'non_custodial',
        title: 'Non-Custodial Orientation',
        description: 'AEGIS must not take custody of user funds. Preserve user-controlled assets with transparent routing and auditable actions.',
        check: (change: ProposedChange): ConstitutionViolation | null => {
          if (change.takesCustodyOfFunds) {
            return {
              ruleId: 'non_custodial',
              ruleTitle: 'Non-Custodial Orientation',
              severity: 'critical',
              message: 'This change introduces custodial behavior — AEGIS would hold or control user funds',
              recommendation: 'Redesign to keep funds user-controlled. AEGIS routes and facilitates, it does not custody.',
            };
          }
          return null;
        },
      },
      {
        id: 'smart_routing',
        title: 'Smart Routing Is Central',
        description: 'AEGIS intelligently routes transactions across available rails, optimizing for cost, speed, reliability, liquidity, compliance, and risk.',
        check: (change: ProposedChange): ConstitutionViolation | null => {
          if (change.replacesRoutingWithDirectCall) {
            return {
              ruleId: 'smart_routing',
              ruleTitle: 'Smart Routing Is Central',
              severity: 'high',
              message: 'This change bypasses the smart router with a direct provider call, removing optimization and fallback',
              recommendation: 'Route through the AEGIS Gateway so the router can optimize cost, speed, and reliability.',
            };
          }
          return null;
        },
      },
      {
        id: 'connect_not_build',
        title: 'Connect Rather Than Rebuild',
        description: 'AEGIS connects existing infrastructure (banks, payment processors, mobile money, blockchains, stablecoins, wallets, liquidity providers). Do not default to BUILD.',
        check: (change: ProposedChange): ConstitutionViolation | null => {
          if (change.duplicatesExistingLogic) {
            return {
              ruleId: 'connect_not_build',
              ruleTitle: 'Connect Rather Than Rebuild',
              severity: 'high',
              message: 'This change duplicates logic that already exists in an external provider or internal service',
              recommendation: 'Evaluate BUILD vs INTEGRATE vs DEFER vs ELIMINATE. Prefer integrating the existing solution.',
            };
          }
          return null;
        },
      },
      {
        id: 'vault_engine',
        title: 'Vault Engine Is Preferred Wallet Architecture',
        description: 'Remove UI-level HMAC wallet derivation. UI obtains wallet info through Identity Engine → Vault Engine.',
        check: (change: ProposedChange): ConstitutionViolation | null => {
          if (change.storesPrivateKeyInClient) {
            return {
              ruleId: 'vault_engine',
              ruleTitle: 'Vault Engine Is Preferred Wallet Architecture',
              severity: 'critical',
              message: 'This change places wallet/private key logic at the UI/client level',
              recommendation: 'Move wallet operations to the Vault Engine. UI should request wallet info through Identity Engine → Vault Engine.',
            };
          }
          return null;
        },
      },
      {
        id: 'architecture_as_truth',
        title: 'Architecture Is Source of Truth',
        description: 'Architecture supersedes implementation when they conflict. Code must conform to architecture, not the reverse.',
        check: (change: ProposedChange): ConstitutionViolation | null => {
          if (change.bypassesGateway) {
            return {
              ruleId: 'architecture_as_truth',
              ruleTitle: 'Architecture Is Source of Truth',
              severity: 'high',
              message: 'This change bypasses the AEGIS Gateway, breaking the orchestration boundary',
              recommendation: 'All requests must flow through the Gateway for proper routing, logging, and permission checks.',
            };
          }
          return null;
        },
      },
      {
        id: 'user_control',
        title: 'User Control Over Consequential Decisions',
        description: 'AI can plan and act autonomously, but user retains control over sensitive production operations (wallets, payments, transfers, credentials).',
        check: (change: ProposedChange): ConstitutionViolation | null => {
          if (change.takesCustodyOfFunds && !change.requiresApprovalForExecution) {
            return {
              ruleId: 'user_control',
              ruleTitle: 'User Control Over Consequential Decisions',
              severity: 'critical',
              message: 'This change performs a sensitive financial operation without requiring user approval',
              recommendation: 'Add an approval step. Financial actions must be authorized before execution.',
            };
          }
          return null;
        },
      },
      {
        id: 'no_cross_engine',
        title: 'No Cross-Engine Database Boundaries',
        description: 'Domain engines must not cross each other\'s database boundaries. Each engine owns its data.',
        check: (change: ProposedChange): ConstitutionViolation | null => {
          if (change.crossesEngineBoundary) {
            return {
              ruleId: 'no_cross_engine',
              ruleTitle: 'No Cross-Engine Database Boundaries',
              severity: 'high',
              message: 'This change crosses engine database boundaries',
              recommendation: 'Use the Gateway or a shared interface to communicate between engines. Never directly access another engine\'s database.',
            };
          }
          return null;
        },
      },
      {
        id: 'no_duplicate_logic',
        title: 'No Duplicate Logic',
        description: 'Do not duplicate logic across engines. Shared logic belongs in a shared service.',
        check: (change: ProposedChange): ConstitutionViolation | null => {
          if (change.duplicatesExistingLogic) {
            return {
              ruleId: 'no_duplicate_logic',
              ruleTitle: 'No Duplicate Logic',
              severity: 'medium',
              message: 'This change duplicates existing logic',
              recommendation: 'Extract to a shared service or use the existing implementation.',
            };
          }
          return null;
        },
      },
      {
        id: 'no_client_secrets',
        title: 'No Secrets in Client-Side Code',
        description: 'Never place private keys, privileged credentials, or service keys in client-side code.',
        check: (change: ProposedChange): ConstitutionViolation | null => {
          if (change.addsSecretsToClient || change.storesPrivateKeyInClient) {
            return {
              ruleId: 'no_client_secrets',
              ruleTitle: 'No Secrets in Client-Side Code',
              severity: 'critical',
              message: 'This change introduces secrets or private keys in client-side code',
              recommendation: 'Move secrets to environment variables / server-side vault. Never expose privileged credentials to the client.',
            };
          }
          return null;
        },
      },
      {
        id: 'autonomous_not_unsupervised',
        title: 'Autonomous But Not Unsupervised',
        description: 'AI can plan and act but user retains control over sensitive production operations.',
        check: (change: ProposedChange): ConstitutionViolation | null => {
          if (change.takesCustodyOfFunds && !change.requiresApprovalForExecution) {
            return {
              ruleId: 'autonomous_not_unsupervised',
              ruleTitle: 'Autonomous But Not Unsupervised',
              severity: 'high',
              message: 'Autonomous action on a sensitive operation without supervision',
              recommendation: 'Require explicit user approval before this action executes.',
            };
          }
          return null;
        },
      },
      {
        id: 'build_vs_integrate_vs_defer_vs_eliminate',
        title: 'BUILD vs INTEGRATE vs DEFER vs ELIMINATE',
        description: 'For new functionality, explicitly consider all four options. Do not default to BUILD.',
        check: (change: ProposedChange): ConstitutionViolation | null => {
          // This is a warning-level check, not a hard violation
          return null;
        },
      },
      {
        id: 'errors_first_class',
        title: 'Errors Are First-Class States',
        description: 'Errors (rejected, failed, pending, timed out, partially completed, awaiting approval) are first-class system states. Never describe an action as complete unless execution is verified.',
        check: (change: ProposedChange): ConstitutionViolation | null => {
          if (change.ignoresErrors) {
            return {
              ruleId: 'errors_first_class',
              ruleTitle: 'Errors Are First-Class States',
              severity: 'medium',
              message: 'This change does not properly handle error states',
              recommendation: 'Handle all error states: rejected, failed, pending, timed out, partially completed, awaiting approval, provider unavailable, insufficient balance.',
            };
          }
          return null;
        },
      },
      {
        id: 'routing_explainable',
        title: 'Routing Should Be Explainable',
        description: 'The smart router should be able to explain why it chose a particular route (cost, speed, reliability, liquidity, etc.).',
        check: (change: ProposedChange): ConstitutionViolation | null => {
          if (change.routingNotExplainable) {
            return {
              ruleId: 'routing_explainable',
              ruleTitle: 'Routing Should Be Explainable',
              severity: 'medium',
              message: 'This change makes routing decisions without explanation capability',
              recommendation: 'Add reasoning metadata to routing decisions so the system can explain why a route was chosen.',
            };
          }
          return null;
        },
      },
    ];
  }
}
