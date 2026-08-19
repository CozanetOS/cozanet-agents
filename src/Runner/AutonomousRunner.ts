// ============================================================================
// AutonomousRunner — Self-reporting goal execution loop
// ============================================================================

import { AgentRegistry } from '../AgentRegistry';
import { AgentTask, TaskResult } from '../types';
import { APIKeyVault } from '../Vault/APIKeyVault';

export interface AutonomousGoal {
  id: string;
  description: string;            // what the user wants done
  steps: AutonomousStep[];
  status: 'planning' | 'running' | 'paused' | 'done' | 'failed' | 'cancelled';
  startedAt: number;
  completedAt?: number;
  currentStep: number;
  maxIterations: number;
  iteration: number;
  progressReports: ProgressReport[];
  apiKeyVault: APIKeyVault;       // the worker uses API keys for external calls
  metadata?: Record<string, any>;
}

export interface AutonomousStep {
  index: number;
  description: string;
  agentId: string;
  taskType: string;
  input: any;
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
  result?: any;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  usesApiKey?: {
    provider: string;
    scope?: string;
  };
}

export interface ProgressReport {
  stepIndex: number;
  iteration: number;
  action: string;               // what was done
  result: any;                   // what came back
  status: 'success' | 'failed' | 'partial';
  message: string;               // human-readable summary: "I did X, the result was Y"
  timestamp: number;
  nextAction?: string;           // what the worker plans to do next
  goalComplete: boolean;         // does the worker think the goal is done?
}

export interface AutonomousConfig {
  maxIterations?: number;         // default: 20 — how many step cycles before giving up
  pauseOnFailure?: boolean;      // default: true — pause if a step fails
  reportTo?: string;              // agentId to send progress reports to (e.g., agent:email for notifications)
  requireApiKeyValidation?: boolean; // default: true — validate API keys before using them
  autoContinue?: boolean;         // default: true — automatically continue to next step
}

/**
 * AutonomousRunner — the self-reporting goal execution loop.
 *
 * This is what makes the AutomationAgent a true "worker/staff member":
 *
 * 1. You give it a goal ("check the club's calendar, email members, update the website")
 * 2. It breaks the goal into steps (using CEO + Planner agents)
 * 3. For each step:
 *    a. It checks if it needs an API key — if so, gets one from the vault
 *    b. It executes the step (delegates to the right agent)
 *    c. It generates a ProgressReport: "I did X, the result was Y, next I'll do Z"
 *    d. It checks: is the goal complete? If not, continues.
 * 4. It repeats until the goal is done OR max iterations is reached
 * 5. At the end, it generates a final summary report
 *
 * The key difference from a simple task runner: the AutonomousRunner
 * REPORTS WHAT IT DID after every action, and DECIDES whether to continue.
 *
 * Integration points: cozanet-automation (scheduling), cozanet-identity (API keys),
 * cozanet-communication (notifications for progress reports).
 */
export class AutonomousRunner {
  private goals: Map<string, AutonomousGoal> = new Map();
  private registry: AgentRegistry;
  private vault: APIKeyVault;
  private cancelled: Set<string> = new Set();

  constructor(registry?: AgentRegistry) {
    this.registry = registry || AgentRegistry.getInstance();
    this.vault = new APIKeyVault();
  }

  /** Access the vault directly (for storing/managing keys) */
  public getVault(): APIKeyVault {
    return this.vault;
  }

  // ── Run a Goal Autonomously ────────────────────────────────────────

  /**
   * Give the worker a goal and let it run autonomously.
   * It will plan, execute, report, and continue until done.
   *
   * Example:
   *   runner.runGoal({
   *     description: 'Check club events for next week and email all members',
   *     steps: [
   *       { description: 'Get events from calendar', agentId: 'agent:browser', taskType: 'navigate', input: { url: 'https://club.com/events' } },
   *       { description: 'Extract event data', agentId: 'agent:browser', taskType: 'extract', input: { url: '...', schema: {...} } },
   *       { description: 'Send email to members', agentId: 'agent:email', taskType: 'send', input: { to: 'members@club.com', subject: '...', body: '...' } },
   *     ],
   *   });
   */
  public async runGoal(
    description: string,
    steps: Omit<AutonomousStep, 'index' | 'status'>[],
    config?: AutonomousConfig
  ): Promise<AutonomousGoal> {
    const goalId = `goal:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`;
    const maxIterations = config?.maxIterations ?? 20;

    const goal: AutonomousGoal = {
      id: goalId,
      description,
      steps: steps.map((s, i) => ({ ...s, index: i, status: 'pending' as const })),
      status: 'running',
      startedAt: Date.now(),
      currentStep: 0,
      maxIterations,
      iteration: 0,
      progressReports: [],
      apiKeyVault: this.vault,
    };

    this.goals.set(goalId, goal);

    // Run the loop
    await this.executeLoop(goal, config);

    return goal;
  }

  /**
   * Run a goal but let the CEO + Planner agents break it into steps first.
   * Just give a description, and the system plans automatically.
   */
  public async runGoalAutoPlan(
    description: string,
    config?: AutonomousConfig
  ): Promise<AutonomousGoal> {
    // Delegate to CEO for planning
    const ceo = this.registry.get('agent:ceo');
    let steps: Omit<AutonomousStep, 'index' | 'status'>[] = [];

    if (ceo) {
      const planResult = await ceo.executeTask({
        id: `plan:${Date.now()}`,
        agentId: 'agent:ceo',
        type: 'plan',
        input: { goal: description },
        status: 'pending',
        priority: 'high',
        createdAt: Date.now(),
        retries: 0,
        maxRetries: 3,
      });

      // Convert plan to steps
      if (planResult?.plan) {
        steps = planResult.plan.map((p: any) => ({
          description: p.description || p.task || p.action || 'Unnamed step',
          agentId: p.agentId || 'agent:ceo',
          taskType: p.taskType || p.type || 'delegate',
          input: p.input || p.payload || {},
          usesApiKey: p.usesApiKey,
        }));
      }
    }

    if (steps.length === 0) {
      // Fallback: just delegate to CEO to handle the whole thing
      steps = [{
        description,
        agentId: 'agent:ceo',
        taskType: 'delegate',
        input: { goal: description },
      }];
    }

    return this.runGoal(description, steps, config);
  }

  // ── The Autonomous Loop ───────────────────────────────────────────

  private async executeLoop(goal: AutonomousGoal, config?: AutonomousConfig): Promise<void> {
    while (goal.status === 'running' && goal.iteration < goal.maxIterations) {
      // Check if cancelled
      if (this.cancelled.has(goal.id)) {
        goal.status = 'cancelled';
        break;
      }

      // Check if all steps are done
      const allDone = goal.steps.every(s => s.status === 'done' || s.status === 'skipped');
      if (allDone) {
        goal.status = 'done';
        goal.completedAt = Date.now();
        this.generateFinalReport(goal);
        break;
      }

      // Find the next pending step
      const step = goal.steps.find(s => s.status === 'pending');
      if (!step) {
        goal.status = 'done';
        goal.completedAt = Date.now();
        this.generateFinalReport(goal);
        break;
      }

      goal.currentStep = step.index;
      goal.iteration++;

      // ── Execute the step ───────────────────────────────────────
      step.status = 'running';
      step.startedAt = Date.now();

      try {
        // If the step needs an API key, get one from the vault
        if (step.usesApiKey) {
          const key = this.vault.get(step.usesApiKey.provider, step.usesApiKey.scope);
          if (!key) {
            throw new Error(`No active API key found for provider: ${step.usesApiKey.provider}`);
          }

          // Validate the key if required
          if (config?.requireApiKeyValidation ?? true) {
            const validation = await this.vault.validate(key.id);
            if (!validation.valid) {
              throw new Error(`API key validation failed: ${validation.reason}`);
            }
          }

          // Inject the key into the step input
          step.input = {
            ...step.input,
            apiKey: key.keyValue,
            apiKeyId: key.id,
            provider: step.usesApiKey.provider,
          };
        }

        // Delegate to the agent
        const agent = this.registry.get(step.agentId);
        if (!agent) {
          throw new Error(`Agent ${step.agentId} not found`);
        }

        const result = await agent.executeTask({
          id: `${goal.id}:step:${step.index}`,
          agentId: step.agentId,
          type: step.taskType,
          input: step.input,
          status: 'pending',
          priority: 'normal',
          createdAt: Date.now(),
          retries: 0,
          maxRetries: 3,
        });

        step.result = result;
        step.status = 'done';
        step.completedAt = Date.now();

        // ── Self-report: "I did X, the result was Y" ────────────
        const report: ProgressReport = {
          stepIndex: step.index,
          iteration: goal.iteration,
          action: step.description,
          result,
          status: 'success',
          message: this.generateReport(step, result),
          timestamp: Date.now(),
          nextAction: this.getNextAction(goal, step),
          goalComplete: this.checkGoalComplete(goal),
        };
        goal.progressReports.push(report);

        // Record API key usage if applicable
        if (step.usesApiKey && result?.tokensUsed) {
          const key = this.vault.listByProvider(step.usesApiKey.provider)[0];
          if (key) {
            this.vault.recordUsage(key.id, {
              tokensUsed: result.tokensUsed.input + result.tokensUsed.output,
              cost: result.cost,
              success: true,
            });
          }
        }

        // Send progress notification if configured
        if (config?.reportTo) {
          await this.sendProgressNotification(config.reportTo, goal, report);
        }

        // If goal is complete, stop
        if (report.goalComplete) {
          goal.status = 'done';
          goal.completedAt = Date.now();
          this.generateFinalReport(goal);
          break;
        }

        // Auto-continue to next step
        if (config?.autoContinue === false) {
          goal.status = 'paused';
          break;
        }

      } catch (err: any) {
        step.status = 'failed';
        step.error = err.message;
        step.completedAt = Date.now();

        // Self-report the failure
        const report: ProgressReport = {
          stepIndex: step.index,
          iteration: goal.iteration,
          action: step.description,
          result: null,
          status: 'failed',
          message: `I tried to ${step.description} but it failed: ${err.message}.`,
          timestamp: Date.now(),
          nextAction: config?.pauseOnFailure ? 'Paused — waiting for instructions.' : 'Retrying next step.',
          goalComplete: false,
        };
        goal.progressReports.push(report);

        // Record API key error if applicable
        if (step.usesApiKey) {
          const keys = this.vault.listByProvider(step.usesApiKey.provider);
          for (const k of keys) {
            if (k.status === 'active') {
              this.vault.recordUsage(k.id, { success: false });
            }
          }
        }

        if (config?.pauseOnFailure ?? true) {
          goal.status = 'paused';
          break;
        }
        // If not pausing, continue to next step
      }
    }

    // Max iterations reached
    if (goal.status === 'running') {
      goal.status = 'failed';
      goal.completedAt = Date.now();
      const report: ProgressReport = {
        stepIndex: -1,
        iteration: goal.iteration,
        action: 'Max iterations reached',
        result: null,
        status: 'failed',
        message: `I reached the maximum of ${goal.maxIterations} iterations without completing the goal.`,
        timestamp: Date.now(),
        goalComplete: false,
      };
      goal.progressReports.push(report);
    }
  }

  // ── Self-reporting ─────────────────────────────────────────────────

  /**
   * Generate a human-readable report of what was done.
   * "I checked the club calendar. Found 3 upcoming events. Next I'll email all members."
   */
  private generateReport(step: AutonomousStep, result: any): string {
    const resultSummary = this.summarizeResult(result);
    return `I ${step.description.toLowerCase()}. ${resultSummary}`;
  }

  private summarizeResult(result: any): string {
    if (!result) return 'No result returned.';
    if (typeof result === 'string') return result;
    if (result.message) return result.message;
    if (result.summary) return result.summary;
    if (result.output) return this.summarizeResult(result.output);

    // Summarize common result shapes
    const parts: string[] = [];
    if (result.rows) parts.push(`Found ${result.rows.length} items.`);
    if (result.messages) parts.push(`Processed ${result.messages.length} messages.`);
    if (result.files) parts.push(`Generated ${result.files.length} files.`);
    if (result.sent) parts.push('Sent successfully.');
    if (result.done) parts.push('Completed.');
    if (result.valid) parts.push('Validation passed.');
    if (result.vulnerabilities) parts.push(`Found ${result.vulnerabilities.length} vulnerabilities.`);
    if (result.tests) parts.push(`Ran ${result.tests} tests.`);

    return parts.length > 0 ? parts.join(' ') : 'Done.';
  }

  private getNextAction(goal: AutonomousGoal, completedStep: AutonomousStep): string {
    const nextStep = goal.steps.find(s => s.status === 'pending' && s.index > completedStep.index);
    if (!nextStep) return 'No more steps — goal should be complete.';
    return `Next: ${nextStep.description}`;
  }

  private checkGoalComplete(goal: AutonomousGoal): boolean {
    const pendingSteps = goal.steps.filter(s => s.status === 'pending');
    return pendingSteps.length === 0;
  }

  private generateFinalReport(goal: AutonomousGoal): void {
    const successCount = goal.steps.filter(s => s.status === 'done').length;
    const failedCount = goal.steps.filter(s => s.status === 'failed').length;
    const totalDuration = ((goal.completedAt || Date.now()) - goal.startedAt) / 1000;

    const report: ProgressReport = {
      stepIndex: -1,
      iteration: goal.iteration,
      action: 'Final Report',
      result: { successCount, failedCount, totalDuration },
      status: failedCount > 0 ? 'partial' : 'success',
      message: `Goal "${goal.description}" completed. ${successCount} steps succeeded, ${failedCount} failed. Took ${totalDuration.toFixed(1)}s across ${goal.iteration} iterations.`,
      timestamp: Date.now(),
      goalComplete: true,
    };
    goal.progressReports.push(report);
  }

  // ── Notifications ───────────────────────────────────────────────────

  private async sendProgressNotification(agentId: string, goal: AutonomousGoal, report: ProgressReport): Promise<void> {
    const agent = this.registry.get(agentId);
    if (!agent) return;

    // If reporting to email agent, send a progress email
    if (agentId === 'agent:email') {
      await agent.executeTask({
        id: `notify:${goal.id}:${report.stepIndex}`,
        agentId: 'agent:email',
        type: 'send',
        input: {
          to: goal.metadata?.notifyEmail || 'owner@cozanet.os',
          subject: `[CozanetOS] ${goal.description} — ${report.status}`,
          body: report.message,
        },
        status: 'pending',
        priority: 'normal',
        createdAt: Date.now(),
        retries: 0,
        maxRetries: 3,
      });
    }
  }

  // ── Goal Management ────────────────────────────────────────────────

  public getGoal(goalId: string): AutonomousGoal | null {
    return this.goals.get(goalId) || null;
  }

  public getProgress(goalId: string): { reports: ProgressReport[]; status: string; currentStep: number; totalSteps: number } {
    const goal = this.goals.get(goalId);
    if (!goal) return { reports: [], status: 'not_found', currentStep: 0, totalSteps: 0 };
    return {
      reports: goal.progressReports,
      status: goal.status,
      currentStep: goal.currentStep,
      totalSteps: goal.steps.length,
    };
  }

  public cancelGoal(goalId: string): { cancelled: boolean; goalId: string } {
    const goal = this.goals.get(goalId);
    if (!goal) return { cancelled: false, goalId };
    this.cancelled.add(goalId);
    goal.status = 'cancelled';
    return { cancelled: true, goalId };
  }

  /**
   * Resume a paused goal — continues from where it left off.
   */
  public async resumeGoal(goalId: string, config?: AutonomousConfig): Promise<AutonomousGoal | null> {
    const goal = this.goals.get(goalId);
    if (!goal || goal.status !== 'paused') return null;
    goal.status = 'running';
    await this.executeLoop(goal, config);
    return goal;
  }

  public listGoals(): AutonomousGoal[] {
    return Array.from(this.goals.values());
  }
}
