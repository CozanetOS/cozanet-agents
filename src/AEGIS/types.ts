// ── AEGIS Domain types ──────────────────────────────────────────────────

export type ConstitutionRuleId =
  | 'non_custodial'
  | 'smart_routing'
  | 'connect_not_build'
  | 'vault_engine'
  | 'architecture_as_truth'
  | 'user_control'
  | 'no_cross_engine'
  | 'no_duplicate_logic'
  | 'no_client_secrets'
  | 'autonomous_not_unsupervised'
  | 'build_vs_integrate_vs_defer_vs_eliminate'
  | 'errors_first_class'
  | 'routing_explainable';

export interface ConstitutionRule {
  id: ConstitutionRuleId;
  title: string;
  description: string;
  check: (change: ProposedChange) => ConstitutionViolation | null;
}

export interface ProposedChange {
  title: string;
  description: string;
  files: string[];
  services: string[];
  addsSecretsToClient?: boolean;
  takesCustodyOfFunds?: boolean;
  crossesEngineBoundary?: boolean;
  duplicatesExistingLogic?: boolean;
  hardcodesProviderLockin?: boolean;
  bypassesGateway?: boolean;
  storesPrivateKeyInClient?: boolean;
  requiresApprovalForExecution?: boolean;
  routingNotExplainable?: boolean;
  ignoresErrors?: boolean;
  replacesRoutingWithDirectCall?: boolean;
}

export interface ConstitutionViolation {
  ruleId: ConstitutionRuleId;
  ruleTitle: string;
  severity: 'critical' | 'high' | 'medium';
  message: string;
  recommendation: string;
}

export interface ConstitutionCheckResult {
  passed: boolean;
  violations: ConstitutionViolation[];
  warnings: string[];
  checkedAt: number;
}

// ── Engineering workflow ────────────────────────────────────────────────

export type EngineeringStepId =
  | 'inspect_architecture'
  | 'inspect_implementation'
  | 'identify_boundary'
  | 'plan'
  | 'implement'
  | 'run_tests'
  | 'inspect_diff'
  | 'security_check'
  | 'integration_test'
  | 'prepare_commit'
  | 'approval'
  | 'done';

export interface EngineeringStep {
  id: EngineeringStepId;
  label: string;
  description: string;
  permissionLevel: 'autonomous' | 'prepare' | 'approval_required';
}

export interface EngineeringWorkflowState {
  taskTitle: string;
  currentStep: EngineeringStepId;
  completedSteps: EngineeringStepId[];
  results: Partial<Record<EngineeringStepId, any>>;
  requiresApproval: boolean;
  approvalGranted: boolean;
  startedAt: number;
}

// ── Security check types ───────────────────────────────────────────────

export type SecurityCheckId =
  | 'secret_scan'
  | 'private_key_scan'
  | 'client_secret_scan'
  | 'permission_audit'
  | 'dependency_scan'
  | 'env_separation'
  | 'deployment_safety';

export interface SecurityFinding {
  id: string;
  checkId: SecurityCheckId;
  severity: 'critical' | 'high' | 'medium' | 'low';
  file?: string;
  line?: number;
  description: string;
  remediation: string;
}

export interface SecurityCheckResult {
  target: string;
  findings: SecurityFinding[];
  passed: boolean;
  criticalCount: number;
  highCount: number;
  checkedAt: number;
}
