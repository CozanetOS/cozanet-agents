// ── WorkflowAgent — Real multi-step execution + persistence ──────────
//
// v0.3.0 — Real implementations:
//  - create: Real workflow definition + persistence
//  - execute: Real step-by-step delegation to agents via AgentRegistry
//    (was just pushing {status:'done',output:null} to array)
//  - pause/resume: Real status management + persistence
//  - list/get: Real + persistence

import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';
import { AgentRegistry } from '../AgentRegistry';
import * as fs from 'fs';
import * as path from 'path';

export interface WFStep {
  id: string;
  agentId: string;
  type: string;
  input: any;
  next?: string;
  condition?: string; // jq-style condition for branching
}

export interface WorkflowDef {
  id: string;
  name: string;
  steps: WFStep[];
  status: 'draft' | 'active' | 'paused' | 'completed' | 'failed';
  trigger?: string;
  createdAt: number;
  lastRun?: number;
  runCount: number;
}

export interface WorkflowRunResult {
  workflowId: string;
  status: 'completed' | 'failed';
  stepResults: Array<{ stepId: string; status: string; output: any; durationMs: number }>;
  durationMs: number;
}

/**
 * WorkflowAgent — creates and executes multi-step agent workflows.
 */
export class WorkflowAgent extends BaseAgent {
  private workflows: Map<string, WorkflowDef> = new Map();
  private dataDir: string;

  constructor(dataDir?: string) {
    super('agent:workflow', 'Workflow Agent', 'Multi-Step Workflow Orchestration');
    this.dataDir = dataDir || path.join(process.cwd(), 'data', 'workflows');

    this.registerCapability({
      name: 'workflow',
      description: 'Create, execute, pause, and manage multi-step agent workflows',
      taskTypes: ['create', 'execute', 'pause', 'resume', 'list_workflows', 'get_workflow'],
    });
  }

  protected onStart(): void {
    if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
    this.load();
    console.log(`[${this.id}] Workflow Agent online — ${this.workflows.size} workflows loaded.`);
  }

  public async handle(task: AgentTask): Promise<any> {
    switch (task.type) {
      case 'create':
        return this.create(task.input.name, task.input.steps);
      case 'execute':
        return this.execute(task.input.workflowId);
      case 'pause':
        return this.pauseWorkflow(task.input.workflowId);
      case 'resume':
        return this.resumeWorkflow(task.input.workflowId);
      case 'list_workflows':
        return this.listWorkflows();
      case 'get_workflow':
        return this.getWorkflow(task.input.workflowId);
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  public async create(name: string, steps: any[]): Promise<WorkflowDef> {
    const wf: WorkflowDef = {
      id: `wf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      steps: steps.map((s, i) => ({
        id: s.id || `step_${i}`,
        agentId: s.agentId,
        type: s.type,
        input: s.input || {},
        next: s.next,
        condition: s.condition,
      })),
      status: 'draft',
      createdAt: Date.now(),
      runCount: 0,
    };
    this.workflows.set(wf.id, wf);
    this.save();
    console.log(`[${this.id}] Created workflow: ${name} (${wf.id}) with ${wf.steps.length} steps`);
    return wf;
  }

  // ── Execute (Real step-by-step agent delegation) ──────────────────

  public async execute(workflowId: string): Promise<WorkflowRunResult> {
    const wf = this.workflows.get(workflowId);
    if (!wf) throw new Error(`Workflow ${workflowId} not found`);

    const startTime = Date.now();
    wf.status = 'active';
    wf.lastRun = Date.now();
    wf.runCount++;
    this.save();

    const stepResults: Array<{ stepId: string; status: string; output: any; durationMs: number }> = [];
    const registry = AgentRegistry.getInstance();
    let failed = false;

    for (const step of wf.steps) {
      if (failed) {
        stepResults.push({ stepId: step.id, status: 'skipped', output: null, durationMs: 0 });
        continue;
      }

      console.log(`[${this.id}] Executing step ${step.id} → ${step.agentId} (${step.type})`);
      const stepStart = Date.now();

      try {
        const agent = registry.get(step.agentId);
        if (!agent) {
          throw new Error(`Agent ${step.agentId} not found in registry`);
        }

        const result = await agent.executeTask({
          id: `wf_task_${step.id}_${Date.now()}`,
          agentId: step.agentId,
          type: step.type,
          input: step.input,
          status: 'pending',
          priority: 'normal',
          createdAt: Date.now(),
          retries: 0,
          maxRetries: 3,
        });

        stepResults.push({
          stepId: step.id,
          status: 'done',
          output: result,
          durationMs: Date.now() - stepStart,
        });
      } catch (err: any) {
        console.error(`[${this.id}] Step ${step.id} failed: ${err.message}`);
        stepResults.push({
          stepId: step.id,
          status: 'failed',
          output: { error: err.message },
          durationMs: Date.now() - stepStart,
        });
        failed = true;
      }
    }

    wf.status = failed ? 'failed' : 'completed';
    this.save();

    return {
      workflowId,
      status: failed ? 'failed' : 'completed',
      stepResults,
      durationMs: Date.now() - startTime,
    };
  }

  public async pauseWorkflow(workflowId: string): Promise<{ workflowId: string; paused: boolean }> {
    const wf = this.workflows.get(workflowId);
    if (wf) {
      wf.status = 'paused';
      this.save();
    }
    return { workflowId, paused: !!wf };
  }

  public async resumeWorkflow(workflowId: string): Promise<{ workflowId: string; resumed: boolean }> {
    const wf = this.workflows.get(workflowId);
    if (wf && wf.status === 'paused') {
      wf.status = 'active';
      this.save();
    }
    return { workflowId, resumed: !!wf };
  }

  public async listWorkflows(): Promise<WorkflowDef[]> {
    return Array.from(this.workflows.values());
  }

  public async getWorkflow(workflowId: string): Promise<WorkflowDef | null> {
    return this.workflows.get(workflowId) || null;
  }

  // ── Persistence ─────────────────────────────────────────────────────

  private save(): void {
    if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
    const data = Array.from(this.workflows.values());
    fs.writeFileSync(path.join(this.dataDir, 'workflows.json'), JSON.stringify(data, null, 2));
  }

  private load(): void {
    const filePath = path.join(this.dataDir, 'workflows.json');
    if (!fs.existsSync(filePath)) return;
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      for (const wf of data) {
        this.workflows.set(wf.id, wf);
      }
    } catch { /* start fresh */ }
  }
}
