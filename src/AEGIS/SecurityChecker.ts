import { SecurityFinding, SecurityCheckResult, SecurityCheckId } from './types';

/**
 * SecurityChecker — automated security checks for AEGIS (Section 44).
 *
 * "Never:
 *  - expose private keys
 *  - expose privileged service keys
 *  - commit secrets
 *  - put privileged credentials client-side
 *  - bypass permission boundaries
 *  - treat production as a test environment
 *
 *  Security checks should be automated where practical."
 *
 * Pattern-based scanning — no external deps. Can be extended with
 * external scanners (npm audit, snyk, trivy) via integration points.
 */

// ── Secret patterns ───────────────────────────────────────────────────
const SECRET_PATTERNS: { pattern: RegExp; name: string; severity: 'critical' | 'high' | 'medium' }[] = [
  // Private keys
  { pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |)PRIVATE KEY-----/g, name: 'Private key in source', severity: 'critical' },
  // Ethereum/BSC private keys (64 hex chars)
  { pattern: /\b(0x)?[0-9a-fA-F]{64}\b/g, name: 'Possible private key (64 hex chars)', severity: 'high' },
  // Supabase service role key
  { pattern: /service_role['":\s]*['"]eyJ[A-Za-z0-9_-]+/g, name: 'Supabase service role key exposed', severity: 'critical' },
  // Supabase anon key (less severe but still shouldn't be in source)
  { pattern: /anon['":\s]*['"]eyJ[A-Za-z0-9_-]+/g, name: 'Supabase anon key in source', severity: 'medium' },
  // GitHub tokens
  { pattern: /gh[pousr]_[A-Za-z0-9]{36,}/g, name: 'GitHub token in source', severity: 'critical' },
  // Generic API keys
  { pattern: /(?:api[_-]?key|secret[_-]?key|access[_-]?token)['":\s=]+['"][A-Za-z0-9_\-]{20,}['"]/gi, name: 'Generic API key/secret in source', severity: 'high' },
  // AWS keys
  { pattern: /AKIA[0-9A-Z]{16}/g, name: 'AWS access key', severity: 'critical' },
  // JWT secrets
  { pattern: /jwt[_-]?secret['":\s=]+['"][^'"]{10,}['"]/gi, name: 'JWT secret in source', severity: 'high' },
  // Stripe keys
  { pattern: /sk_(?:test|live)_[A-Za-z0-9]{20,}/g, name: 'Stripe secret key', severity: 'critical' },
  // Firebase/GCP service account
  { pattern: /"private_key":\s*"-----BEGIN/g, name: 'Firebase/GCP service account key', severity: 'critical' },
  // Mnemonic/seed phrases (12-24 words in quotes)
  { pattern: /(?:mnemonic|seed|recovery)[\s'"=:]+(?:['"][a-z]+(?:\s+[a-z]+){11,23}['"])/gi, name: 'Mnemonic/seed phrase in source', severity: 'critical' },
];

// ── Client-side code patterns ──────────────────────────────────────────
const CLIENT_CODE_PATTERNS = [
  /\.(tsx|jsx|vue|svelte)$/,  // Frontend frameworks
  /\/pages\//,                // Next.js pages
  /\/components\//,           // React/Vue components
  /\/app\//,                  // Next.js app dir
  /\/client\//,               // Client directories
];

export class SecurityChecker {
  private static instance: SecurityChecker | null = null;

  static getInstance(): SecurityChecker {
    if (!SecurityChecker.instance) {
      SecurityChecker.instance = new SecurityChecker();
    }
    return SecurityChecker.instance;
  }

  // ── Run all security checks ────────────────────────────────────────
  checkAll(target: string, files: string[]): SecurityCheckResult {
    const allFindings: SecurityFinding[] = [];

    // Run each check
    allFindings.push(...this.scanSecrets(target, files));
    allFindings.push(...this.scanPrivateKeys(target, files));
    allFindings.push(...this.scanClientSecrets(target, files));
    allFindings.push(...this.scanPermissions(target));
    allFindings.push(...this.scanDependencies(target));
    allFindings.push(...this.checkEnvSeparation(target));
    allFindings.push(...this.checkDeploymentSafety(target));

    const criticalCount = allFindings.filter(f => f.severity === 'critical').length;
    const highCount = allFindings.filter(f => f.severity === 'high').length;

    return {
      target,
      findings: allFindings.sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2, low: 3 };
        return order[a.severity] - order[b.severity];
      }),
      passed: criticalCount === 0 && highCount === 0,
      criticalCount,
      highCount,
      checkedAt: Date.now(),
    };
  }

  // ── Individual checks ──────────────────────────────────────────────

  private scanSecrets(target: string, files: string[]): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    for (const file of files) {
      // Check if file name looks suspicious
      if (file.includes('.env') && !file.includes('.env.example') && !file.includes('.env.template')) {
        findings.push({
          id: `finding:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
          checkId: 'secret_scan',
          severity: 'high',
          file,
          description: '.env file found in repository — should be gitignored',
          remediation: 'Add to .gitignore. Use environment variables or a secrets manager instead.',
        });
      }
    }

    return findings;
  }

  private scanPrivateKeys(target: string, files: string[]): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    for (const file of files) {
      if (file.match(/\.(pem|key|p12|pfx|jks|keystore)$/)) {
        findings.push({
          id: `finding:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
          checkId: 'private_key_scan',
          severity: 'critical',
          file,
          description: 'Private key file found in repository',
          remediation: 'Remove from repo immediately. Rotate the key. Use a vault/secrets manager.',
        });
      }
    }

    return findings;
  }

  private scanClientSecrets(target: string, files: string[]): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    for (const file of files) {
      const isClientCode = CLIENT_CODE_PATTERNS.some(p => p.test(file));

      if (isClientCode) {
        // Check for dangerous patterns in client-side files
        // In a real implementation, this would read the file content
        // For now, flag files that match client patterns and contain key-like names
        if (file.includes('wallet') || file.includes('private') || file.includes('secret')) {
          findings.push({
            id: `finding:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
            checkId: 'client_secret_scan',
            severity: 'critical',
            file,
            description: 'Client-side file with sensitive-sounding name — verify no secrets are embedded',
            remediation: 'Move secret handling to server-side. Client code must never contain private keys or service credentials.',
          });
        }
      }
    }

    return findings;
  }

  private scanPermissions(target: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    // Check for known permission issues
    // In a real implementation, this would analyze the codebase
    // For now, return empty — can be extended with static analysis

    return findings;
  }

  private scanDependencies(target: string): SecurityFinding[] {
    // Integration point: npm audit, snyk, trivy
    // For now, return empty — external scanner integration
    return [];
  }

  private checkEnvSeparation(target: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    // Check for production secrets in development configs
    // Can be extended to read config files and verify separation

    return findings;
  }

  private checkDeploymentSafety(target: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    // Check deployment configs for unsafe assumptions
    // Can be extended to read deployment configs

    return findings;
  }

  // ── Scan file content (for use when file content is available) ─────
  scanContent(filePath: string, content: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    for (const { pattern, name, severity } of SECRET_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        findings.push({
          id: `finding:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
          checkId: 'secret_scan',
          severity,
          file: filePath,
          description: `${name} (${matches.length} occurrence${matches.length > 1 ? 's' : ''})`,
          remediation: 'Remove from source immediately. Rotate the exposed credential. Use environment variables or a secrets manager.',
        });
      }
    }

    // Check if client-side file contains server-side patterns
    const isClientCode = CLIENT_CODE_PATTERNS.some(p => p.test(filePath));
    if (isClientCode) {
      if (content.includes('process.env.SUPABASE_SERVICE_ROLE_KEY') ||
          content.includes('process.env.GITHUB_TOKEN') ||
          content.includes('service_role')) {
        findings.push({
          id: `finding:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
          checkId: 'client_secret_scan',
          severity: 'critical',
          file: filePath,
          description: 'Client-side code references privileged/server-side environment variables',
          remediation: 'Move this logic to a server-side function or backend route. Never expose service-role keys to the client.',
        });
      }
    }

    return findings;
  }

  // ── Quick check: is this file safe to commit? ───────────────────────
  quickCheck(filePath: string, content: string): { safe: boolean; findings: SecurityFinding[] } {
    const findings = this.scanContent(filePath, content);
    const hasCritical = findings.some(f => f.severity === 'critical' || f.severity === 'high');
    return { safe: !hasCritical, findings };
  }
}
