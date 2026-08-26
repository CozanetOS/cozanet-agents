import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';

/**
 * TemplateAgent — copy this file to build any new CozanetOS agent.
 *
 * HOW TO USE (see NEW_AGENT_GUIDE.md for the full checklist):
 *  1. Copy this folder/file, rename `TemplateAgent` -> `YourNameAgent`.
 *  2. Change the id/name/role in the constructor.
 *  3. List every task type this agent can handle in `taskTypes`.
 *  4. Add one `case` per task type inside `handle()`.
 *  5. Implement each private method the switch calls into.
 *  6. Register it in AgentOrchestrator.ts (import + push into `allAgents`).
 *  7. Export it from index.ts.
 *
 * That's the ENTIRE pattern. Every agent in this codebase (APIAgent,
 * AnalyticsAgent, SecurityAgent, etc.) follows exactly this shape —
 * don't invent a new one.
 *
 * NOTE: This file is a reference template only. It is intentionally
 * NOT registered in AgentOrchestrator.ts and NOT exported from index.ts —
 * it exists purely to be copied, not run.
 */
export class TemplateAgent extends BaseAgent {
  constructor() {
    // id: unique, lowercase, prefixed "agent:" — e.g. 'agent:template'
    // name: human-readable — shows up in status/health reports
    // role: one-line description of what this agent owns
    super('agent:template', 'Template Agent', 'One-line description of what this agent is responsible for');

    this.registerCapability({
      name: 'template',
      description: 'What this capability lets other agents/the orchestrator ask this agent to do',
      // Every string here must have a matching `case` in handle() below.
      taskTypes: ['do_something', 'get_status_example'],
    });
  }

  // Called once when AgentOrchestrator.initialize() starts this agent.
  // Use it to set up connections, load config, register sub-resources —
  // NOT to do real work yet.
  protected onStart(): void {
    console.log(`[${this.id}] Template Agent online.`);
  }

  // Optional: called on stop/pause/resume/error. Override only what you need.
  // protected onStop(): void {}
  // protected onError(error: string): void { super.onError(error); }

  // This is the ONLY required method. Every task this agent receives
  // (from AgentOrchestrator.submitTask, delegate, or the queue) arrives
  // here. Route by task.type, call a private method per case, and throw
  // a clear Error for anything unsupported — never fail silently.
  public async handle(task: AgentTask): Promise<any> {
    switch (task.type) {
      case 'do_something':
        return this.doSomething(task.input);
      case 'get_status_example':
        return this.getStatusExample();
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  // ── Private implementation methods — one per task type ──────────────

  private async doSomething(input: any): Promise<{ ok: boolean; received: any }> {
    // Replace with real logic. Keep methods small and single-purpose —
    // this is what makes the agent testable and easy to extend later.
    return { ok: true, received: input };
  }

  private async getStatusExample(): Promise<{ status: string }> {
    return { status: this.getStatus() };
  }
}
