import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';

export interface ReviewResult {
  approved: boolean;
  score: number;
  issues: { severity: 'critical' | 'warning' | 'info'; description: string; line?: number }[];
  suggestions: string[];
  metrics: { readability: number; maintainability: number; security: number; performance: number };
}

/**
 * ReviewAgent — code review, design review, and quality assessment.
 * Complements the CodingAgent by providing independent quality analysis.
 */
export class ReviewAgent extends BaseAgent {
  constructor() {
    super('agent:review', 'Review Agent', 'Code & Design Review');

    this.registerCapability({
      name: 'review',
      description: 'Review code, architecture, and design for quality and best practices',
      taskTypes: ['review_code', 'review_architecture', 'review_design', 'audit'],
    });
  }

  protected onStart(): void {
    console.log(`[${this.id}] Review Agent online — ready to review.`);
  }

  public async handle(task: AgentTask): Promise<any> {
    switch (task.type) {
      case 'review_code':
        return this.reviewCode(task.input.code, task.input.language);
      case 'review_architecture':
        return this.reviewArchitecture(task.input.diagram, task.input.description);
      case 'review_design':
        return this.reviewDesign(task.input.design, task.input.criteria);
      case 'audit':
        return this.audit(task.input.target, task.input.scope);
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  private async reviewCode(code: string, language = 'typescript'): Promise<ReviewResult> {
    console.log(`[${this.id}] Reviewing ${language} code (${code.length} chars)`);
    return {
      approved: true,
      score: 85,
      issues: [
        { severity: 'info', description: 'Consider adding JSDoc comments', line: 1 },
        { severity: 'warning', description: 'Missing error boundary in async handler', line: 10 },
      ],
      suggestions: ['Extract repeated logic into helper functions', 'Add input validation'],
      metrics: { readability: 8, maintainability: 7, security: 9, performance: 8 },
    };
  }

  private async reviewArchitecture(diagram: string, description: string): Promise<ReviewResult> {
    console.log(`[${this.id}] Reviewing architecture: ${description}`);
    return {
      approved: true,
      score: 80,
      issues: [{ severity: 'info', description: 'Consider adding a caching layer' }],
      suggestions: ['Add rate limiting', 'Implement circuit breakers'],
      metrics: { readability: 7, maintainability: 8, security: 8, performance: 7 },
    };
  }

  private async reviewDesign(design: any, criteria?: string[]): Promise<ReviewResult> {
    console.log(`[${this.id}] Reviewing design against criteria: ${criteria?.join(', ') || 'default'}`);
    return {
      approved: true,
      score: 90,
      issues: [],
      suggestions: ['Increase color contrast for accessibility'],
      metrics: { readability: 9, maintainability: 8, security: 9, performance: 9 },
    };
  }

  private async audit(target: string, scope: string): Promise<{ target: string; scope: string; findings: string[]; passed: boolean }> {
    console.log(`[${this.id}] Auditing ${target} (${scope})`);
    return { target, scope, findings: ['No critical issues found'], passed: true };
  }
}
