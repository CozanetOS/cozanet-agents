// ── ReviewAgent — Real LLM-powered code & architecture review ────────
//
// v0.3.0 — All methods now use ModelAdapter for real LLM analysis:
//  - reviewCode(): Real LLM code review with structured JSON output
//    (severity, issues, suggestions, metrics, approval decision)
//  - reviewArchitecture(): Real LLM architecture review against
//    AEGIS architecture principles and best practices
//  - reviewDesign(): Real LLM design review against custom criteria
//  - audit(): Real LLM audit with structured findings + severity
//  - reviewPR(): New — review a pull request diff (additions + deletions)

import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';
import { ContextManager } from '../context/ContextManager';
import { ModelAdapter } from '../models/ModelAdapter';

export interface ReviewResult {
  approved: boolean;
  score: number;
  issues: Array<{
    severity: 'critical' | 'high' | 'warning' | 'info';
    description: string;
    line?: number;
    suggestion?: string;
  }>;
  suggestions: string[];
  metrics: {
    readability: number;
    maintainability: number;
    security: number;
    performance: number;
  };
  summary: string;
  reviewedAt: number;
}

export interface AuditResult {
  target: string;
  scope: string;
  findings: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    recommendation: string;
  }>;
  passed: boolean;
  score: number;
  auditedAt: number;
}

export interface PRReviewResult {
  verdict: 'approve' | 'request_changes' | 'needs_review';
  summary: string;
  issues: Array<{
    file: string;
    line?: number;
    severity: 'critical' | 'high' | 'warning' | 'info';
    description: string;
  }>;
  positives: string[];
  score: number;
  reviewedAt: number;
}

/**
 * ReviewAgent — code review, design review, and quality assessment.
 * Uses LLM for real analysis, not hardcoded scores.
 */
export class ReviewAgent extends BaseAgent {
  private model: ModelAdapter;

  constructor() {
    super('agent:review', 'Review Agent', 'Code & Design Review');
    this.model = ModelAdapter.getInstance();

    this.registerCapability({
      name: 'review',
      description: 'Review code, architecture, and design for quality and best practices',
      taskTypes: ['review', 'review_code', 'review_architecture', 'review_design', 'audit', 'review_pr'],
    });
  }

  protected onStart(): void {
    console.log(`[${this.id}] Review Agent online — LLM-powered review ready.`);
  }

  public async handle(task: AgentTask): Promise<any> {
    switch (task.type) {
      case 'review':
      case 'review_code':
        return this.reviewCode(task.input.code, task.input.language);
      case 'review_architecture':
        return this.reviewArchitecture(task.input.diagram, task.input.description);
      case 'review_design':
        return this.reviewDesign(task.input.design, task.input.criteria);
      case 'audit':
        return this.audit(task.input.target, task.input.scope, task.input.content);
      case 'review_pr':
        return this.reviewPR(task.input.diff, task.input.title, task.input.files);
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  // ── Code Review (Real LLM) ───────────────────────────────────────────

  public async reviewCode(code: string, language: string = 'typescript'): Promise<ReviewResult> {
    console.log(`[${this.id}] Reviewing ${language} code (${code.length} chars)`);

    const systemPrompt = `You are a senior code reviewer. Review the given ${language} code thoroughly.

Return a JSON object with this exact structure:
{
  "approved": true/false (approve if production-ready),
  "score": 0-100 (overall quality score),
  "issues": [
    {
      "severity": "critical" | "high" | "warning" | "info",
      "description": "what's wrong",
      "line": <line number or null>,
      "suggestion": "how to fix it"
    }
  ],
  "suggestions": ["improvement 1", "improvement 2"],
  "metrics": {
    "readability": 0-10,
    "maintainability": 0-10,
    "security": 0-10,
    "performance": 0-10
  },
  "summary": "2-3 sentence overall assessment"
}

Be strict. Security issues and bugs are critical/high. Style issues are info.
Return ONLY the JSON.`;

    try {
      const result = await this.model.generate(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: code.slice(0, 10000) },
        ],
        { maxTokens: 2048, temperature: 0.2, responseFormat: 'json' },
      );

      const parsed = this.parseJSON<any>(result.text, null);

      if (parsed) {
        return {
          approved: parsed.approved ?? false,
          score: this.clampScore(parsed.score ?? 0),
          issues: this.normalizeIssues(parsed.issues),
          suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
          metrics: this.normalizeMetrics(parsed.metrics),
          summary: parsed.summary || '',
          reviewedAt: Date.now(),
        };
      }

      return this.fallbackReview(code, 'Could not parse LLM review output');
    } catch (err: any) {
      return this.fallbackReview(code, `Review failed: ${err.message}`);
    }
  }

  // ── Architecture Review (Real LLM) ───────────────────────────────────

  public async reviewArchitecture(diagram: string, description: string): Promise<ReviewResult> {
    console.log(`[${this.id}] Reviewing architecture: ${description.slice(0, 60)}`);

    const domainContext = this.getContext();

    const systemPrompt = `You are a senior software architect. Review the given architecture.
${domainContext ? `Project context: ${domainContext.slice(0, 1000)}` : ''}

Evaluate: separation of concerns, scalability, security boundaries, coupling,
failure modes, data flow, and adherence to best practices.

Return a JSON object:
{
  "approved": true/false,
  "score": 0-100,
  "issues": [
    {
      "severity": "critical" | "high" | "warning" | "info",
      "description": "architectural concern",
      "suggestion": "how to address it"
    }
  ],
  "suggestions": ["improvement 1", ...],
  "metrics": {
    "readability": 0-10 (clarity of the architecture),
    "maintainability": 0-10,
    "security": 0-10,
    "performance": 0-10
  },
  "summary": "overall assessment"
}
Return ONLY the JSON.`;

    try {
      const input = `Description: ${description}\n\nDiagram/Structure:\n${diagram}`;
      const result = await this.model.generate(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: input.slice(0, 10000) },
        ],
        { maxTokens: 2048, temperature: 0.2, responseFormat: 'json' },
      );

      const parsed = this.parseJSON<any>(result.text, null);

      if (parsed) {
        return {
          approved: parsed.approved ?? false,
          score: this.clampScore(parsed.score ?? 0),
          issues: this.normalizeIssues(parsed.issues),
          suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
          metrics: this.normalizeMetrics(parsed.metrics),
          summary: parsed.summary || '',
          reviewedAt: Date.now(),
        };
      }

      return this.fallbackReview(description, 'Could not parse architecture review');
    } catch (err: any) {
      return this.fallbackReview(description, `Architecture review failed: ${err.message}`);
    }
  }

  // ── Design Review (Real LLM) ────────────────────────────────────────

  public async reviewDesign(design: any, criteria?: string[]): Promise<ReviewResult> {
    console.log(`[${this.id}] Reviewing design against: ${criteria?.join(', ') || 'default criteria'}`);

    const criteriaStr = criteria && criteria.length > 0
      ? `Evaluate against these specific criteria: ${criteria.join(', ')}`
      : 'Evaluate against general design principles: usability, consistency, accessibility, performance.';

    const designStr = typeof design === 'string' ? design : JSON.stringify(design);

    const systemPrompt = `You are a senior design reviewer. ${criteriaStr}

Return a JSON object:
{
  "approved": true/false,
  "score": 0-100,
  "issues": [
    {
      "severity": "critical" | "high" | "warning" | "info",
      "description": "design issue",
      "suggestion": "how to fix it"
    }
  ],
  "suggestions": ["improvement 1", ...],
  "metrics": {
    "readability": 0-10 (clarity of the design),
    "maintainability": 0-10,
    "security": 0-10,
    "performance": 0-10
  },
  "summary": "overall design assessment"
}
Return ONLY the JSON.`;

    try {
      const result = await this.model.generate(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: designStr.slice(0, 8000) },
        ],
        { maxTokens: 1024, temperature: 0.2, responseFormat: 'json' },
      );

      const parsed = this.parseJSON<any>(result.text, null);

      if (parsed) {
        return {
          approved: parsed.approved ?? false,
          score: this.clampScore(parsed.score ?? 0),
          issues: this.normalizeIssues(parsed.issues),
          suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
          metrics: this.normalizeMetrics(parsed.metrics),
          summary: parsed.summary || '',
          reviewedAt: Date.now(),
        };
      }

      return this.fallbackReview(designStr, 'Could not parse design review');
    } catch (err: any) {
      return this.fallbackReview(designStr, `Design review failed: ${err.message}`);
    }
  }

  // ── Audit (Real LLM) ─────────────────────────────────────────────────

  public async audit(target: string, scope: string, content?: string): Promise<AuditResult> {
    console.log(`[${this.id}] Auditing ${target} (${scope})`);

    const systemPrompt = `You are a quality auditor. Audit the given target for the specified scope.

Return a JSON object:
{
  "findings": [
    {
      "severity": "critical" | "high" | "medium" | "low",
      "description": "what was found",
      "recommendation": "how to fix it"
    }
  ],
  "passed": true/false (passed if no critical or high findings),
  "score": 0-100
}
Return ONLY the JSON.`;

    try {
      const input = content
        ? `Target: ${target}\nScope: ${scope}\nContent:\n${content.slice(0, 10000)}`
        : `Target: ${target}\nScope: ${scope}`;

      const result = await this.model.generate(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: input },
        ],
        { maxTokens: 1024, temperature: 0.2, responseFormat: 'json' },
      );

      const parsed = this.parseJSON<any>(result.text, null);

      if (parsed) {
        const findings = Array.isArray(parsed.findings) ? parsed.findings.map((f: any) => ({
          severity: ['critical', 'high', 'medium', 'low'].includes(f.severity) ? f.severity : 'low',
          description: f.description || 'Unknown finding',
          recommendation: f.recommendation || 'No recommendation',
        })) : [];

        const hasCritical = findings.some((f: any) => f.severity === 'critical' || f.severity === 'high');

        return {
          target,
          scope,
          findings,
          passed: parsed.passed ?? !hasCritical,
          score: this.clampScore(parsed.score ?? 0),
          auditedAt: Date.now(),
        };
      }

      return {
        target,
        scope,
        findings: [],
        passed: false,
        score: 0,
        auditedAt: Date.now(),
      };
    } catch {
      return {
        target,
        scope,
        findings: [],
        passed: false,
        score: 0,
        auditedAt: Date.now(),
      };
    }
  }

  // ── PR Review (New — review a pull request diff) ───────────────────

  public async reviewPR(diff: string, title?: string, files?: string[]): Promise<PRReviewResult> {
    console.log(`[${this.id}] Reviewing PR: ${title || 'untitled'} (${files?.length || 0} files)`);

    const systemPrompt = `You are a PR reviewer. Review the given diff for quality, correctness, and best practices.

Return a JSON object:
{
  "verdict": "approve" | "request_changes" | "needs_review",
  "summary": "1-2 sentence overall assessment",
  "issues": [
    {
      "file": "filename",
      "line": <line number or null>,
      "severity": "critical" | "high" | "warning" | "info",
      "description": "what's wrong"
    }
  ],
  "positives": ["what was done well 1", ...],
  "score": 0-100
}

Be constructive. Note both problems AND good practices.
Return ONLY the JSON.`;

    try {
      const input = `Title: ${title || 'Untitled PR'}\nFiles: ${files?.join(', ') || 'unknown'}\n\nDiff:\n${diff.slice(0, 10000)}`;

      const result = await this.model.generate(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: input },
        ],
        { maxTokens: 2048, temperature: 0.2, responseFormat: 'json' },
      );

      const parsed = this.parseJSON<any>(result.text, null);

      if (parsed) {
        const validVerdicts = ['approve', 'request_changes', 'needs_review'];
        return {
          verdict: validVerdicts.includes(parsed.verdict) ? parsed.verdict : 'needs_review',
          summary: parsed.summary || '',
          issues: Array.isArray(parsed.issues) ? parsed.issues.map((i: any) => ({
            file: i.file || 'unknown',
            line: i.line || undefined,
            severity: ['critical', 'high', 'warning', 'info'].includes(i.severity) ? i.severity : 'info',
            description: i.description || '',
          })) : [],
          positives: Array.isArray(parsed.positives) ? parsed.positives : [],
          score: this.clampScore(parsed.score ?? 0),
          reviewedAt: Date.now(),
        };
      }

      return {
        verdict: 'needs_review',
        summary: 'Could not parse PR review',
        issues: [],
        positives: [],
        score: 0,
        reviewedAt: Date.now(),
      };
    } catch {
      return {
        verdict: 'needs_review',
        summary: 'PR review failed — LLM unavailable',
        issues: [],
        positives: [],
        score: 0,
        reviewedAt: Date.now(),
      };
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private parseJSON<T>(text: string, fallback: T): T {
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      return fallback;
    }
  }

  private clampScore(value: number): number {
    return Math.max(0, Math.min(100, Number(value) || 0));
  }

  private normalizeIssues(issues: any): ReviewResult['issues'] {
    if (!Array.isArray(issues)) return [];
    const validSeverities = ['critical', 'high', 'warning', 'info'];
    return issues.map((i: any) => ({
      severity: validSeverities.includes(i.severity) ? i.severity : 'info',
      description: i.description || 'Unknown issue',
      line: i.line || undefined,
      suggestion: i.suggestion || i.remediation || undefined,
    }));
  }

  private normalizeMetrics(metrics: any): ReviewResult['metrics'] {
    if (!metrics || typeof metrics !== 'object') {
      return { readability: 0, maintainability: 0, security: 0, performance: 0 };
    }
    return {
      readability: Math.max(0, Math.min(10, Number(metrics.readability) || 0)),
      maintainability: Math.max(0, Math.min(10, Number(metrics.maintainability) || 0)),
      security: Math.max(0, Math.min(10, Number(metrics.security) || 0)),
      performance: Math.max(0, Math.min(10, Number(metrics.performance) || 0)),
    };
  }

  private fallbackReview(code: string, error: string): ReviewResult {
    return {
      approved: false,
      score: 0,
      issues: [{ severity: 'info', description: error }],
      suggestions: [],
      metrics: { readability: 0, maintainability: 0, security: 0, performance: 0 },
      summary: error,
      reviewedAt: Date.now(),
    };
  }

  // ── Domain Context ───────────────────────────────────────────────────
  private context: string | null = null;

  public getContext(): string {
    if (!this.context) {
      this.context = ContextManager.loadDomainContext('AEGIS');
    }
    return this.context;
  }

  public refreshContext(): void {
    this.context = null;
  }
}
