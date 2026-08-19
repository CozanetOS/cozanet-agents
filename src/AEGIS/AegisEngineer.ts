import {
  EngineeringStep, EngineeringStepId, EngineeringWorkflowState,
  ProposedChange, ConstitutionCheckResult,
} from './types';
import { AegisConstitution } from './AegisConstitution';
import { SecurityChecker } from './SecurityChecker';

/**
 * AegisEngineer — AEGIS Engineering Workflow (Section 41).
 *
 * 12-step workflow:
 *   TASK → INSPECT ARCHITECTURE → INSPECT IMPLEMENTATION →
 *   IDENTIFY BOUNDARY → PLAN → IMPLEMENT → RUN TESTS →
 *   INSPECT DIFF → SECURITY CHECK → INTEGRATION TEST →
 *   PREPARE COMMIT/PR → APPROVAL IF REQUIRED
 *
 * Output format (Section 82):
 *   WHAT I CHANGED / WHAT I TESTED / WHAT PASSED / WHAT FAILED /
 *   WHAT REMAINS / RISKS / FILES/COMMITS / NEXT ACTION
 */
export class AegisEngineer {
  private constitution: AegisConstitution;
  private securityChecker: SecurityChecker;

  private static steps: EngineeringStep[] = [
    { id: 'inspect_architecture', label: 'Inspect Architecture',       description: 'Check proposed change against AEGIS constitution',         permissionLevel: 'autonomous' },
    { id: 'inspect_implementation', label: 'Inspect Implementation',    description: 'Review existing code in affected services',              permissionLevel: 'autonomous' },
    { id: 'identify_boundary', label: 'Identify Service Boundary',     description: 'Determine correct engine/service boundary for the change', permissionLevel: 'autonomous' },
    { id: 'plan', label: 'Plan',                                       description: 'Create implementation plan with files to change',         permissionLevel: 'autonomous' },
    { id: 'implement', label: 'Implement',                              description: 'Write code changes',                                      permissionLevel: 'prepare' },
    { id: 'run_tests', label: 'Run Tests',                             description: 'Execute unit and integration tests',                     permissionLevel: 'autonomous' },
    { id: 'inspect_diff', label: 'Inspect Diff',                       description: 'Review the diff for correctness and completeness',      permissionLevel: 'autonomous' },
    { id: 'security_check', label: 'Security Check',                   description: 'Run automated security checks',                          permissionLevel: 'autonomous' },
    { id: 'integration_test', label: 'Integration Test',               description: 'Test integration with other services',                   permissionLevel: 'autonomous' },
    { id: 'prepare_commit', label: 'Prepare Commit/PR',              description: 'Stage, commit, push, create PR',                        permissionLevel: 'prepare' },
    { id: 'approval', label: 'Approval If Required',                  description: 'Wait for user approval if change requires it',           permissionLevel: 'approval_required' },
    { id: 'done', label: 'Done',                                       description: 'Task complete',                                           permissionLevel: 'autonomous' },
  ];

  constructor() {
    this.constitution = AegisConstitution.getInstance();
    this.securityChecker = new SecurityChecker();
  }

  // ── Start a new engineering workflow ──────────────────────────────
  startWorkflow(taskTitle: string, proposedChange: ProposedChange): EngineeringWorkflowState & { constitutionCheck: ConstitutionCheckResult } {
    // Step 1: Inspect architecture — run constitution check
    const constitutionCheck = this.constitution.check(proposedChange);

    if (!constitutionCheck.passed) {
      // Return early with violations — don't proceed past architecture check
      return {
        taskTitle,
        currentStep: 'inspect_architecture',
        completedSteps: [],
        results: { inspect_architecture: constitutionCheck },
        requiresApproval: false,
        approvalGranted: false,
        startedAt: Date.now(),
        constitutionCheck,
      };
    }

    return {
      taskTitle,
      currentStep: 'inspect_implementation',
      completedSteps: ['inspect_architecture'],
      results: { inspect_architecture: constitutionCheck },
      requiresApproval: proposedChange.requiresApprovalForExecution ?? false,
      approvalGranted: false,
      startedAt: Date.now(),
      constitutionCheck,
    };
  }

  // ── Get the full workflow definition ──────────────────────────────
  getWorkflow(): EngineeringStep[] {
    return AegisEngineer.steps;
  }

  // ── Get current step info ──────────────────────────────────────────
  getCurrentStep(state: EngineeringWorkflowState): EngineeringStep | null {
    return AegisEngineer.steps.find(s => s.id === state.currentStep) ?? null;
  }

  // ── Advance to next step ───────────────────────────────────────────
  advance(state: EngineeringWorkflowState, stepResult: any): EngineeringWorkflowState {
    const currentIdx = AegisEngineer.steps.findIndex(s => s.id === state.currentStep);
    if (currentIdx === -1) return state;

    // Record result
    state.results[state.currentStep] = stepResult;
    if (!state.completedSteps.includes(state.currentStep)) {
      state.completedSteps.push(state.currentStep);
    }

    // Check if we need approval before proceeding
    const nextStep = AegisEngineer.steps[currentIdx + 1];
    if (nextStep?.id === 'approval' && state.requiresApproval && !state.approvalGranted) {
      state.currentStep = 'approval';
      return state;
    }

    // Skip approval step if not required
    if (nextStep?.id === 'approval' && (!state.requiresApproval || state.approvalGranted)) {
      state.currentStep = 'done';
      return state;
    }

    state.currentStep = nextStep?.id ?? 'done';
    return state;
  }

  // ── Grant approval ─────────────────────────────────────────────────
  grantApproval(state: EngineeringWorkflowState): EngineeringWorkflowState {
    state.approvalGranted = true;
    state.currentStep = 'done';
    state.completedSteps.push('approval');
    return state;
  }

  // ── Run security check (Step 8) ────────────────────────────────────
  runSecurityCheck(target: string, files: string[]): any {
    return this.securityChecker.checkAll(target, files);
  }

  // ── Format engineering output (Section 82) ─────────────────────────
  formatOutput(result: {
    changed: string;
    tested: string;
    passed: string;
    failed: string;
    remaining: string;
    risks: string;
    files: string;
    nextAction: string;
  }): string {
    return [
      `WHAT I CHANGED: ${result.changed}`,
      `WHAT I TESTED: ${result.tested}`,
      `WHAT PASSED: ${result.passed}`,
      `WHAT FAILED: ${result.failed}`,
      `WHAT REMAINS: ${result.remaining}`,
      `RISKS: ${result.risks}`,
      `FILES/COMMITS: ${result.files}`,
      `NEXT ACTION: ${result.nextAction}`,
    ].join('\n');
  }

  // ── BUILD vs INTEGRATE vs DEFER vs ELIMINATE analysis ──────────────
  evaluateBuildVsIntegratevsDefervsEliminate(feature: {
    name: string;
    description: string;
    existingProviders?: string[];
    buildEffort?: 'low' | 'medium' | 'high';
    strategicValue?: 'low' | 'medium' | 'high';
  }): { recommendation: 'BUILD' | 'INTEGRATE' | 'DEFER' | 'ELIMINATE'; reasoning: string } {
    const { existingProviders, buildEffort, strategicValue } = feature;

    // If providers exist and strategic value is low/medium → INTEGRATE
    if (existingProviders && existingProviders.length > 0) {
      if (strategicValue === 'low' || strategicValue === 'medium') {
        return {
          recommendation: 'INTEGRATE',
          reasoning: `${existingProviders.length} provider(s) already offer this. Strategic value is ${strategicValue}. Connect rather than rebuild.`,
        };
      }
      // High strategic value with existing providers → still consider INTEGRATE unless build effort is low
      if (buildEffort !== 'low') {
        return {
          recommendation: 'INTEGRATE',
          reasoning: `High strategic value, but ${existingProviders.length} provider(s) exist and build effort is ${buildEffort}. Integrate first, build only if integration proves insufficient.`,
        };
      }
    }

    // No existing providers, low effort → BUILD
    if ((!existingProviders || existingProviders.length === 0) && buildEffort === 'low') {
      return {
        recommendation: 'BUILD',
        reasoning: 'No existing providers found and build effort is low. Building is justified.',
      };
    }

    // No providers, high effort, low value → DEFER
    if (strategicValue === 'low' && buildEffort === 'high') {
      return {
        recommendation: 'DEFER',
        reasoning: 'Low strategic value with high build effort and no existing providers. Defer until value increases or a provider emerges.',
      };
    }

    // Default
    return {
      recommendation: 'INTEGRATE',
      reasoning: 'Default to INTEGRATE. Evaluate existing infrastructure before building.',
    };
  }
}
