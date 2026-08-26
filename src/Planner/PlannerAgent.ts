// ── PlannerAgent — LLM-powered dynamic planning ─────────────────────
//
// v0.3.0 — Real implementations:
//  - plan(): LLM generates dynamic steps based on goal (was hardcoded 5 steps)
//  - replan(): LLM adjusts plan after failure (was just filtering)
//  - estimate(): LLM estimates duration per step (was hardcoded "~1-2 min")
//  - prioritize(): Real priority sorting (already was)

import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';
import { ContextManager } from '../context/ContextManager';
import { ModelAdapter } from '../models/ModelAdapter';

export interface PlanStep {
  description: string;
  assignee: string;
  type: string;
  input: any;
  priority: 'low' | 'normal' | 'high' | 'critical';
  dependencies: string[];
}

export interface PlanResult {
  steps: PlanStep[];
  estimatedDuration: string;
  riskLevel: 'low' | 'medium' | 'high';
  reasoning: string;
}

/**
 * PlannerAgent — breaks down goals into actionable, prioritized steps.
 */
export class PlannerAgent extends BaseAgent {
  private model: ModelAdapter;

  constructor() {
    super('agent:planner', 'Planner Agent', 'Task Planning & Breakdown');
    this.model = ModelAdapter.getInstance();

    this.registerCapability({
      name: 'planning',
      description: 'Decompose goals into prioritized, dependency-aware steps',
      taskTypes: ['plan', 'replan', 'estimate', 'prioritize'],
    });
  }

  protected onStart(): void {
    console.log(`[${this.id}] Planner Agent online — ready to strategize.`);
  }

  public async handle(task: AgentTask): Promise<any> {
    switch (task.type) {
      case 'plan':
        return this.plan(task.input.goal);
      case 'replan':
        return this.replan(task.input.goal, task.input.completedSteps, task.input.failedStep);
      case 'estimate':
        return this.estimate(task.input.steps);
      case 'prioritize':
        return this.prioritize(task.input.steps);
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  public async plan(goal: string): Promise<PlanResult> {
    console.log(`[${this.id}] Breaking down goal: ${goal}`);

    try {
      const result = await this.model.generate([
        {
          role: 'system',
          content: `You are a task planning AI. Break down the given goal into actionable steps.
Available agents and their task types:
- agent:research → research, analyze, verify, summarize, fact_check
- agent:coding → generate_code, refactor, review_code, explain
- agent:review → review_code, audit, suggest, compare
- agent:testing → run_tests, generate_tests, benchmark, coverage
- agent:security → scan, encrypt, audit, assess_risk, check_permissions
- agent:browser → navigate, extract, scrape, search_web
- agent:email → send, draft, search, triage, reply
- agent:documents → create, convert, search, summarize, template
- agent:knowledge → index, query, extract, link, summarize_topic
- agent:analytics → track, report, trend, insights, aggregate
- agent:integration → connect, call, sync, health_check

Return JSON:
{
  "steps": [{"description":"...","assignee":"agent:xxx","type":"task_type","input":{...},"priority":"normal","dependencies":[]}],
  "estimatedDuration": "~X min",
  "riskLevel": "low|medium|high",
  "reasoning": "why this plan"
}
Only JSON.`,
        },
        { role: 'user', content: `Goal: ${goal}` },
      ], { maxTokens: 1000, temperature: 0.4, responseFormat: 'json' });

      const parsed = this.parseJSON<any>(result.text, null);
      if (parsed && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
        return {
          steps: parsed.steps,
          estimatedDuration: parsed.estimatedDuration || '~5-10 min',
          riskLevel: parsed.riskLevel || 'low',
          reasoning: parsed.reasoning || 'LLM-generated plan',
        };
      }
    } catch (err: any) {
      console.log(`[${this.id}] LLM planning failed: ${err.message}, using fallback`);
    }

    // Fallback: heuristic plan
    return this.fallbackPlan(goal);
  }

  public async replan(goal: string, completedSteps: string[], failedStep: string): Promise<PlanResult> {
    console.log(`[${this.id}] Replanning after failure at: ${failedStep}`);

    try {
      const result = await this.model.generate([
        {
          role: 'system',
          content: `You are a task planning AI. A previous plan failed at step "${failedStep}".
Completed steps: ${completedSteps.join(', ')}.
Create a NEW plan that avoids the failure and continues the goal.
Return the same JSON format as the original plan. Only JSON.`,
        },
        { role: 'user', content: `Goal: ${goal}\nFailed step: ${failedStep}\nCompleted: ${JSON.stringify(completedSteps)}` },
      ], { maxTokens: 800, temperature: 0.4, responseFormat: 'json' });

      const parsed = this.parseJSON<any>(result.text, null);
      if (parsed && Array.isArray(parsed.steps)) {
        return {
          steps: parsed.steps,
          estimatedDuration: parsed.estimatedDuration || '~3-5 min',
          riskLevel: 'medium',
          reasoning: `Replanned after failure at ${failedStep}`,
        };
      }
    } catch { /* fallback below */ }

    const freshPlan = await this.plan(goal);
    freshPlan.steps = freshPlan.steps.filter(s => !completedSteps.includes(s.assignee));
    freshPlan.riskLevel = 'medium';
    freshPlan.reasoning = `Fallback replan after ${failedStep}`;
    return freshPlan;
  }

  public async estimate(steps: PlanStep[]): Promise<{ totalTime: string; perStep: Record<string, string> }> {
    try {
      const stepDescriptions = steps.map(s => `${s.description} (${s.assignee})`).join('\n');

      const result = await this.model.generate([
        {
          role: 'system',
          content: 'Estimate realistic execution time for each task step. Return JSON: {"totalTime":"~X min","perStep":{"step description":"~Y min"}}. Only JSON.',
        },
        { role: 'user', content: stepDescriptions },
      ], { maxTokens: 500, temperature: 0.3, responseFormat: 'json' });

      const parsed = this.parseJSON<any>(result.text, null);
      if (parsed && parsed.totalTime) return parsed;
    } catch { /* fallback */ }

    // Fallback: heuristic estimation
    const perStep: Record<string, string> = {};
    for (const step of steps) {
      const baseTime = step.priority === 'critical' ? 1 : step.priority === 'high' ? 2 : 3;
      perStep[step.description] = `~${baseTime}-${baseTime + 2} min`;
    }
    return { totalTime: `~${steps.length * 2} min`, perStep };
  }

  public async prioritize(steps: PlanStep[]): Promise<PlanStep[]> {
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    return [...steps].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  // ── Fallback plan (heuristic) ──────────────────────────────────────

  private fallbackPlan(goal: string): PlanResult {
    return {
      steps: [
        {
          description: `Research information on "${goal}"`,
          assignee: 'agent:research',
          type: 'research',
          input: { topic: goal },
          priority: 'high',
          dependencies: [],
        },
        {
          description: `Analyze and plan implementation for "${goal}"`,
          assignee: 'agent:coding',
          type: 'generate_code',
          input: { spec: goal, language: 'typescript' },
          priority: 'normal',
          dependencies: ['agent:research'],
        },
        {
          description: `Review for "${goal}"`,
          assignee: 'agent:review',
          type: 'review_code',
          input: { code: '' },
          priority: 'normal',
          dependencies: ['agent:coding'],
        },
        {
          description: `Security scan for "${goal}"`,
          assignee: 'agent:security',
          type: 'scan',
          input: { target: goal },
          priority: 'high',
          dependencies: ['agent:coding'],
        },
      ],
      estimatedDuration: '~5-10 min',
      riskLevel: 'low',
      reasoning: 'Heuristic fallback plan (LLM unavailable)',
    };
  }

  // ── Domain Context ──────────────────────────────────────────────────
  private context: string | null = null;

  public getContext(): string {
    if (!this.context) {
      this.context = ContextManager.loadDomainContext('Personal');
    }
    return this.context;
  }

  public refreshContext(): void {
    this.context = null;
  }

  private parseJSON<T>(text: string, fallback: T): T {
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    try { return JSON.parse(cleaned) as T; } catch { return fallback; }
  }
}
