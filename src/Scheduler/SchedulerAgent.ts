import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';

export interface ScheduledJob {
  id: string;
  name: string;
  cron: string;
  agentId: string;
  taskType: string;
  input: any;
  status: 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';
  nextRun: number;
  lastRun?: number;
}

/**
 * SchedulerAgent — manages cron-based scheduled jobs and one-time future tasks.
 * Integration point: cozanet-automation engine.
 */
export class SchedulerAgent extends BaseAgent {
  private jobs: Map<string, ScheduledJob> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super('agent:scheduler', 'Scheduler Agent', 'Cron Scheduling & Time-Based Triggers');

    this.registerCapability({
      name: 'scheduler',
      description: 'Schedule, cancel, and manage cron jobs and one-time tasks',
      taskTypes: ['schedule', 'schedule_once', 'cancel', 'list_jobs', 'get_job', 'reschedule'],
    });
  }

  protected onStart(): void {
    console.log(`[${this.id}] Scheduler Agent online — managing schedules.`);
  }

  public async handle(task: AgentTask): Promise<any> {
    switch (task.type) {
      case 'schedule':
        return this.schedule(task.input.name, task.input.cron, task.input.agentId, task.input.taskType, task.input.input);
      case 'schedule_once':
        return this.scheduleOnce(task.input.name, task.input.executeAt, task.input.agentId, task.input.taskType, task.input.input);
      case 'cancel':
        return this.cancel(task.input.jobId);
      case 'list_jobs':
        return this.listJobs();
      case 'get_job':
        return this.getJob(task.input.jobId);
      case 'reschedule':
        return this.reschedule(task.input.jobId, task.input.cron);
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  private async schedule(name: string, cron: string, agentId: string, taskType: string, input: any): Promise<ScheduledJob> {
    const job: ScheduledJob = {
      id: `job:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
      name, cron, agentId, taskType, input,
      status: 'scheduled',
      nextRun: Date.now() + 60000, // Placeholder: parse cron to compute next run
    };
    this.jobs.set(job.id, job);
    console.log(`[${this.id}] Scheduled "${name}" with cron: ${cron}`);
    // Integration point: cozanet-automation cron parser
    return job;
  }

  private async scheduleOnce(name: string, executeAt: number, agentId: string, taskType: string, input: any): Promise<ScheduledJob> {
    const delay = executeAt - Date.now();
    if (delay <= 0) throw new Error('Execution time must be in the future');

    const job: ScheduledJob = {
      id: `job:once:${Date.now()}`,
      name, cron: 'once', agentId, taskType, input,
      status: 'scheduled',
      nextRun: executeAt,
    };
    this.jobs.set(job.id, job);

    const timer = setTimeout(() => {
      job.status = 'running';
      job.lastRun = Date.now();
      // Integration point: trigger AgentOrchestrator.submitTask
      console.log(`[${this.id}] Firing one-time job: ${name}`);
      job.status = 'completed';
    }, delay);
    this.timers.set(job.id, timer);

    return job;
  }

  private async cancel(jobId: string): Promise<{ jobId: string; cancelled: boolean }> {
    const job = this.jobs.get(jobId);
    const timer = this.timers.get(jobId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(jobId);
    }
    if (job) job.status = 'cancelled';
    return { jobId, cancelled: !!job };
  }

  private async listJobs(): Promise<ScheduledJob[]> {
    return Array.from(this.jobs.values());
  }

  private async getJob(jobId: string): Promise<ScheduledJob | null> {
    return this.jobs.get(jobId) || null;
  }

  private async reschedule(jobId: string, cron: string): Promise<{ jobId: string; rescheduled: boolean }> {
    const job = this.jobs.get(jobId);
    if (!job) return { jobId, rescheduled: false };
    job.cron = cron;
    job.status = 'scheduled';
    return { jobId, rescheduled: true };
  }

  protected onStop(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}
