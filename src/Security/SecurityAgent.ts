// ── SecurityAgent — Real crypto, real scanning, real audits ──────────
//
// v0.3.0 — All methods now use real implementations:
//  - encrypt/decrypt: Node.js crypto module (AES-256-GCM with random IV + auth tag)
//  - scan: LLM-powered code/config vulnerability scanning with pattern matching
//  - audit: Real audit log with structured entries
//  - checkPermissions: Real RBAC with role hierarchy
//  - rotateKeys: Real key generation + rotation tracking
//
// CRITICAL FIX: Replaced base64 "encryption" with AES-256-GCM authenticated encryption.
// Base64 is ENCODING not ENCRYPTION — it was a real vulnerability.

import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';
import { ContextManager } from '../context/ContextManager';
import { ModelAdapter } from '../models/ModelAdapter';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface SecurityScanResult {
  target: string;
  vulnerabilities: Array<{
    id: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    cwe?: string;
    line?: number;
    remediation: string;
  }>;
  passed: boolean;
  score: number;
  scannedAt: number;
  scanType: 'code' | 'config' | 'secrets' | 'dependencies';
}

export interface EncryptionResult {
  encrypted: string;   // base64-encoded ciphertext + auth tag
  algorithm: string;
  iv: string;          // base64-encoded IV
  authTag: string;     // base64-encoded GCM auth tag
  keyId?: string;
}

export interface DecryptionResult {
  decrypted: string;
  verified: boolean;   // GCM auth tag verification
}

export interface AuditEntry {
  auditId: string;
  action: string;
  actor: string;
  timestamp: number;
  resource?: string;
  result: 'success' | 'denied' | 'failed';
  metadata?: Record<string, any>;
}

export interface PermissionCheckResult {
  allowed: boolean;
  reason: string;
  role?: string;
  requiredRole?: string;
}

export interface SecurityKeyRotationResult {
  service: string;
  rotated: boolean;
  newKeyId: string;
  previousKeyId?: string;
  rotatedAt: number;
}

// ── RBAC Role Hierarchy ───────────────────────────────────────────────

const ROLE_HIERARCHY: Record<string, number> = {
  owner: 100,
  admin: 80,
  developer: 60,
  auditor: 40,
  user: 20,
  guest: 0,
};

const RESOURCE_REQUIRED_ROLES: Record<string, Record<string, string>> = {
  wallet: { transfer: 'owner', view: 'user', sign: 'owner', rotate: 'admin' },
  security: { scan: 'developer', rotate_keys: 'admin', view_audit: 'auditor', encrypt: 'developer' },
  system: { shutdown: 'owner', config: 'admin', deploy: 'developer' },
  data: { read: 'user', write: 'developer', delete: 'admin', export: 'admin' },
};

// ── Secret Detection Patterns ─────────────────────────────────────────

const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp; severity: 'critical' | 'high' | 'medium'; cwe: string }> = [
  { name: 'Private key', pattern: /(?:private|priv|secret)[\s_-]*key[\s:=]+['"]?(0x)?[0-9a-fA-F]{64}['"]?/gi, severity: 'critical', cwe: 'CWE-798' },
  { name: 'Mnemonic phrase', pattern: /\b(?:abandon|about|above|absent|absorb|abstract|absurd|abuse|access|accident)\b.*\b(?:abandon|about|above|absent|absorb|abstract|absurd|abuse|access|accident)\b/gi, severity: 'critical', cwe: 'CWE-312' },
  { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/g, severity: 'high', cwe: 'CWE-798' },
  { name: 'Supabase service role key', pattern: /service[_-]?role[\s_-]*key[\s:=]+['"]?eyJ[a-zA-Z0-9_-]+['"]?/gi, severity: 'critical', cwe: 'CWE-798' },
  { name: 'Hardcoded API key', pattern: /(?:api[\s_-]*key|apikey|token|secret)[\s:=]+['"]?[a-zA-Z0-9_-]{32,}['"]?/gi, severity: 'high', cwe: 'CWE-798' },
  { name: 'JWT secret', pattern: /jwt[\s_-]*(?:secret|key)[\s:=]+['"]?[a-zA-Z0-9_-]{16,}['"]?/gi, severity: 'high', cwe: 'CWE-798' },
  { name: 'Database URL with password', pattern: /(?:postgres|mysql|mongodb):\/\/[^:]+:[^@]+@/gi, severity: 'high', cwe: 'CWE-798' },
  { name: 'Private key file reference', pattern: /(?:PRIVATE\s+KEY)/gi, severity: 'high', cwe: 'CWE-312' },
];

// ── Code Vulnerability Patterns ───────────────────────────────────────

const CODE_PATTERNS: Array<{ name: string; pattern: RegExp; severity: 'critical' | 'high' | 'medium' | 'low'; cwe: string; remediation: string }> = [
  {
    name: 'eval() usage',
    pattern: /\beval\s*\(/g,
    severity: 'critical',
    cwe: 'CWE-94',
    remediation: 'Remove eval(). Use JSON.parse() for data or refactor to avoid dynamic code execution.',
  },
  {
    name: 'SQL injection',
    pattern: /(?:query|execute|sql)\s*\(\s*['"`].*(?:\$\{|\\s\+\s*).*(?:SELECT|INSERT|UPDATE|DELETE|DROP)/gi,
    severity: 'critical',
    cwe: 'CWE-89',
    remediation: 'Use parameterized queries or prepared statements instead of string concatenation.',
  },
  {
    name: 'XSS via innerHTML',
    pattern: /\.innerHTML\s*=\s*[^'"]*(?:\$\{|\\s\+\s*)/gi,
    severity: 'high',
    cwe: 'CWE-79',
    remediation: 'Use textContent or sanitize HTML before assignment to innerHTML.',
  },
  {
    name: 'Hardcoded password',
    pattern: /(?:password|passwd|pwd)[\s:=]+['"][^'"]{3,}['"]/gi,
    severity: 'high',
    cwe: 'CWE-798',
    remediation: 'Use environment variables or a secret manager. Never hardcode passwords.',
  },
  {
    name: 'Insecure random for crypto',
    pattern: /Math\.random\(\)[^;]*(?:key|token|secret|password|iv|salt)/gi,
    severity: 'high',
    cwe: 'CWE-330',
    remediation: 'Use crypto.randomBytes() or crypto.getRandomValues() for security-sensitive randomness.',
  },
  {
    name: 'Disabled TLS verification',
    pattern: /rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED/gi,
    severity: 'high',
    cwe: 'CWE-295',
    remediation: 'Never disable TLS certificate verification in production.',
  },
  {
    name: 'Base64 used as encryption',
    pattern: /(?:encrypt|secure|hash)[^;]*\.toString\s*\(\s*['"]base64['"]\s*\)/gi,
    severity: 'medium',
    cwe: 'CWE-327',
    remediation: 'Base64 is encoding, not encryption. Use crypto.createCipheriv() with AES-256-GCM.',
  },
  {
    name: 'console.log with sensitive data',
    pattern: /console\.(log|error|warn|info)\s*\([^)]*(?:password|secret|key|token|private|mnemonic)/gi,
    severity: 'medium',
    cwe: 'CWE-532',
    remediation: 'Remove sensitive data from log statements.',
  },
  {
    name: 'HTTP (no TLS)',
    pattern: /https?:\/\/(?!localhost|127\.0\.0\.1)/gi,
    severity: 'low',
    cwe: 'CWE-319',
    remediation: 'Use HTTPS for all external communications.',
  },
];

/**
 * SecurityAgent — cryptographic isolation, vulnerability scanning, audit logging.
 * Uses Node.js crypto module for real encryption, pattern matching for scanning,
 * and LLM for intelligent vulnerability analysis.
 */
export class SecurityAgent extends BaseAgent {
  private model: ModelAdapter;
  private auditLog: AuditEntry[] = [];
  private keyStore: Map<string, { key: Buffer; keyId: string; createdAt: number }> = new Map();
  private static readonly ENCRYPTION_KEY_ENV = 'COZANET_ENCRYPTION_KEY';
  private static readonly ENCRYPTION_ALGO = 'aes-256-gcm';

  constructor() {
    super('agent:security', 'Security Agent', 'Security Scanning & Access Control');
    this.model = ModelAdapter.getInstance();

    this.registerCapability({
      name: 'security',
      description: 'Scan for vulnerabilities, manage credentials, audit, and enforce policies',
      taskTypes: ['scan', 'audit', 'encrypt', 'decrypt', 'check_permissions', 'rotate_keys'],
    });
  }

  protected onStart(): void {
    console.log(`[${this.id}] Security Agent online — real crypto + scanning active.`);
  }

  public async handle(task: AgentTask): Promise<any> {
    switch (task.type) {
      case 'scan':
        return this.scan(task.input.target, task.input.scope, task.input.content);
      case 'audit':
        return this.audit(task.input.action, task.input.actor, task.input.resource, task.input.result);
      case 'encrypt':
        return this.encrypt(task.input.data, task.input.keyId);
      case 'decrypt':
        return this.decrypt(task.input.data, task.input.key, task.input.iv, task.input.authTag);
      case 'check_permissions':
        return this.checkPermissions(task.input.userId, task.input.role, task.input.resource, task.input.action);
      case 'rotate_keys':
        return this.rotateKeys(task.input.service);
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  // ── Encryption (REAL AES-256-GCM) ───────────────────────────────────

  public async encrypt(data: string, keyId?: string): Promise<EncryptionResult> {
    console.log(`[${this.id}] Encrypting ${data.length} bytes with AES-256-GCM`);

    const key = this.getOrCreateKey(keyId);
    const iv = crypto.randomBytes(12); // AES-GCM standard IV size
    const cipher = crypto.createCipheriv(SecurityAgent.ENCRYPTION_ALGO, key, iv);

    let encrypted = cipher.update(data, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      algorithm: SecurityAgent.ENCRYPTION_ALGO,
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      keyId: this.getKeyId(key),
    };
  }

  // ── Decryption (REAL AES-256-GCM with auth verification) ────────────

  public async decrypt(
    encryptedData: string,
    key?: string | Buffer,
    iv?: string,
    authTag?: string,
  ): Promise<DecryptionResult> {
    console.log(`[${this.id}] Decrypting with AES-256-GCM`);

    let keyBuffer: Buffer;
    if (typeof key === 'string') {
      // Try to get from keystore first, then treat as base64-encoded key
      const stored = this.keyStore.get(key);
      if (stored) {
        keyBuffer = stored.key;
      } else {
        keyBuffer = Buffer.from(key, 'base64');
      }
    } else if (key) {
      keyBuffer = key;
    } else {
      keyBuffer = this.getOrCreateKey();
    }

    const ivBuffer = iv ? Buffer.from(iv, 'base64') : crypto.randomBytes(12);
    const authTagBuffer = authTag ? Buffer.from(authTag, 'base64') : Buffer.alloc(16);

    const decipher = crypto.createDecipheriv(SecurityAgent.ENCRYPTION_ALGO, keyBuffer, ivBuffer);
    decipher.setAuthTag(authTagBuffer);

    try {
      let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      return { decrypted, verified: true };
    } catch (err: any) {
      // GCM auth tag verification failed — tampered or wrong key
      return {
        decrypted: '',
        verified: false,
      };
    }
  }

  // ── Vulnerability Scanning ─────────────────────────────────────────

  public async scan(
    target: string,
    scope: string = 'full',
    content?: string,
  ): Promise<SecurityScanResult> {
    console.log(`[${this.id}] Scanning ${target} (${scope})`);

    // If content is provided directly, scan it
    // Otherwise try to read from file path
    let scanContent = content;
    if (!scanContent && fs.existsSync(target)) {
      scanContent = fs.readFileSync(target, 'utf8');
    }
    scanContent = scanContent || '';

    const vulnerabilities: SecurityScanResult['vulnerabilities'] = [];

    // Phase 1: Pattern-based scanning (instant, no LLM needed)
    const scanType = this.determineScanType(target, scanContent);

    if (scanType === 'secrets' || scope === 'full' || scope === 'secrets') {
      for (const pattern of SECRET_PATTERNS) {
        const matches = [...scanContent.matchAll(pattern.pattern)];
        for (const match of matches) {
          vulnerabilities.push({
            id: `VULN-${vulnerabilities.length + 1}`,
            severity: pattern.severity,
            description: `${pattern.name} detected`,
            cwe: pattern.cwe,
            line: this.getLineNumber(scanContent, match.index || 0),
            remediation: 'Remove the secret and use environment variables or a secret manager.',
          });
        }
      }
    }

    if (scanType === 'code' || scope === 'full' || scope === 'code') {
      for (const pattern of CODE_PATTERNS) {
        const matches = [...scanContent.matchAll(pattern.pattern)];
        for (const match of matches) {
          vulnerabilities.push({
            id: `VULN-${vulnerabilities.length + 1}`,
            severity: pattern.severity,
            description: pattern.name,
            cwe: pattern.cwe,
            line: this.getLineNumber(scanContent, match.index || 0),
            remediation: pattern.remediation,
          });
        }
      }
    }

    // Phase 2: LLM-powered deep analysis (if content is substantial)
    if (scanContent.length > 50 && scanContent.length < 10000) {
      const llmVulns = await this.llmScan(scanContent, scanType);
      // Merge LLM findings, avoiding duplicates from pattern scan
      for (const llmV of llmVulns) {
        const isDuplicate = vulnerabilities.some(
          v => v.description.toLowerCase() === llmV.description.toLowerCase() ||
               (v.cwe && v.cwe === llmV.cwe && v.line === llmV.line),
        );
        if (!isDuplicate) {
          vulnerabilities.push({
            ...llmV,
            id: `VULN-${vulnerabilities.length + 1}`,
          });
        }
      }
    }

    // Calculate score (100 = no issues, lower = more/worse issues)
    const score = this.calculateScore(vulnerabilities);
    const passed = vulnerabilities.filter(v => v.severity === 'critical' || v.severity === 'high').length === 0;

    return {
      target,
      vulnerabilities,
      passed,
      score,
      scannedAt: Date.now(),
      scanType,
    };
  }

  // ── LLM-Powered Deep Security Analysis ─────────────────────────────

  private async llmScan(
    content: string,
    scanType: string,
  ): Promise<Array<Omit<SecurityScanResult['vulnerabilities'][0], 'id'>>> {
    const systemPrompt = `You are a security scanner. Analyze the given ${scanType} for security vulnerabilities.
Return a JSON array of vulnerabilities found:
[
  {
    "severity": "critical|high|medium|low",
    "description": "what's vulnerable",
    "cwe": "CWE-XXX",
    "line": <line number or null>,
    "remediation": "how to fix it"
  }
]

Only report REAL vulnerabilities. No false positives. If the code is clean, return [].
Return ONLY the JSON array, no markdown fences.`;

    try {
      const result = await this.model.generate(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: content.slice(0, 8000) },
        ],
        { maxTokens: 2048, temperature: 0.2, responseFormat: 'json' },
      );

      const cleaned = this.stripMarkdown(result.text);
      const parsed = JSON.parse(cleaned);

      if (Array.isArray(parsed)) {
        return parsed.filter((v: any) => v.severity && v.description);
      }
      return [];
    } catch {
      // LLM unavailable — pattern scan results are still valid
      return [];
    }
  }

  // ── Audit Logging (real structured entries) ────────────────────────

  public async audit(
    action: string,
    actor: string,
    resource?: string,
    result: 'success' | 'denied' | 'failed' = 'success',
  ): Promise<{ logged: boolean; auditId: string; entry: AuditEntry }> {
    const entry: AuditEntry = {
      auditId: `audit:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
      action,
      actor,
      resource,
      result,
      timestamp: Date.now(),
    };

    this.auditLog.push(entry);

    // Keep audit log to last 10000 entries
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-10000);
    }

    console.log(`[${this.id}] AUDIT: ${actor} → ${action} on ${resource || 'system'} [${result}]`);

    return { logged: true, auditId: entry.auditId, entry };
  }

  public getAuditLog(limit = 100): AuditEntry[] {
    return this.auditLog.slice(-limit);
  }

  // ── Permission Check (real RBAC) ────────────────────────────────────

  public async checkPermissions(
    userId: string,
    role: string,
    resource: string,
    action: string,
  ): Promise<PermissionCheckResult> {
    const userLevel = ROLE_HIERARCHY[role?.toLowerCase()] ?? -1;

    if (userLevel < 0) {
      return {
        allowed: false,
        reason: `Unknown role: ${role}`,
        role,
      };
    }

    const resourcePermissions = RESOURCE_REQUIRED_ROLES[resource?.toLowerCase()];
    if (!resourcePermissions) {
      // No specific permissions defined for this resource — allow if user has any valid role
      return {
        allowed: true,
        reason: `No specific permissions required for resource: ${resource}`,
        role,
      };
    }

    const requiredRole = resourcePermissions[action?.toLowerCase()];
    if (!requiredRole) {
      // No specific permission for this action — allow
      return {
        allowed: true,
        reason: `No specific permission required for: ${action} on ${resource}`,
        role,
      };
    }

    const requiredLevel = ROLE_HIERARCHY[requiredRole.toLowerCase()] ?? 0;
    const allowed = userLevel >= requiredLevel;

    return {
      allowed,
      reason: allowed
        ? `User role '${role}' (level ${userLevel}) meets required '${requiredRole}' (level ${requiredLevel})`
        : `User role '${role}' (level ${userLevel}) below required '${requiredRole}' (level ${requiredLevel})`,
      role,
      requiredRole,
    };
  }

  // ── Key Rotation (real key generation) ─────────────────────────────

  public async rotateKeys(service: string): Promise<SecurityKeyRotationResult> {
    const newKey = crypto.randomBytes(32); // AES-256 key
    const keyId = `key:${service}:${Date.now()}`;
    const previousKeyId = this.keyStore.get(service)?.keyId;

    this.keyStore.set(service, {
      key: newKey,
      keyId,
      createdAt: Date.now(),
    });

    // Log the rotation
    await this.audit('rotate_keys', 'system', `keys:${service}`, 'success');

    console.log(`[${this.id}] Rotated keys for ${service}: ${previousKeyId || 'none'} → ${keyId}`);

    return {
      service,
      rotated: true,
      newKeyId: keyId,
      previousKeyId,
      rotatedAt: Date.now(),
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private static readonly SESSION_KEY_ID = 'session:default';

  private getOrCreateKey(keyId?: string): Buffer {
    // Check env var for persistent key
    const envKey = process.env[SecurityAgent.ENCRYPTION_KEY_ENV];
    if (envKey) {
      const key = Buffer.from(envKey, 'base64');
      if (key.length === 32) return key;
    }

    // Use provided keyId, or default session key ID
    const effectiveKeyId = keyId || SecurityAgent.SESSION_KEY_ID;

    // Check keystore
    if (this.keyStore.has(effectiveKeyId)) {
      return this.keyStore.get(effectiveKeyId)!.key;
    }

    // Generate a new session key (stable for this process lifetime)
    // WARN: For production, always use COZANET_ENCRYPTION_KEY env var
    const newKey = crypto.randomBytes(32);
    this.keyStore.set(effectiveKeyId, {
      key: newKey,
      keyId: effectiveKeyId,
      createdAt: Date.now(),
    });
    console.warn(`[${this.id}] WARNING: Generated session-scoped encryption key. Set ${SecurityAgent.ENCRYPTION_KEY_ENV} for persistent encryption.`);
    return newKey;
  }

  private getKeyId(key: Buffer): string {
    for (const [id, entry] of this.keyStore.entries()) {
      if (entry.key.equals(key)) return entry.keyId;
    }
    return 'env-key';
  }

  private determineScanType(target: string, content: string): SecurityScanResult['scanType'] {
    const ext = path.extname(target).toLowerCase();
    if (['.ts', '.js', '.py', '.rs', '.go', '.java', '.sol'].includes(ext)) return 'code';
    if (['.env', '.yml', '.yaml', '.json', '.toml', '.config'].includes(ext)) return 'config';
    if (content.match(/(?:PRIVATE\s+KEY|BEGIN\s+\w+\s+PRIVATE\s+KEY)/i)) return 'secrets';
    if (content.match(/(?:api[_-]?key|secret|token|password|mnemonic)/i)) return 'secrets';
    return 'code';
  }

  private getLineNumber(content: string, index: number): number {
    return content.slice(0, index).split('\n').length;
  }

  private calculateScore(vulns: SecurityScanResult['vulnerabilities']): number {
    if (vulns.length === 0) return 100;
    let penalty = 0;
    for (const v of vulns) {
      switch (v.severity) {
        case 'critical': penalty += 40; break;
        case 'high': penalty += 20; break;
        case 'medium': penalty += 10; break;
        case 'low': penalty += 5; break;
      }
    }
    return Math.max(0, 100 - penalty);
  }

  private stripMarkdown(text: string): string {
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    return cleaned;
  }

  // ── Domain Context ───────────────────────────────────────────────────
  private context: string | null = null;

  public getContext(): string {
    if (!this.context) {
      this.context = ContextManager.loadDomainContext('Security');
    }
    return this.context;
  }

  public refreshContext(): void {
    this.context = null;
  }
}
