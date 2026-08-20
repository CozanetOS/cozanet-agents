import { GitHubActionsWorkflow, WorkflowJob, WorkflowStep } from './Phase8Types';

/**
 * GitHubActionsConfig — Section 46: "GitHub Actions as Remote Hands."
 *
 * Architecture:
 *   Cozanet OS → GitHub → Repository → GitHub Actions → Tests/Build/Security/Jobs
 *   → Results → Cozanet OS
 *
 * "This is how the system can continue engineering without requiring
 *  a local laptop for every task."
 *
 * Generates GitHub Actions workflow YAML files for:
 *   - CI (build + test on every push/PR)
 *   - Security scans (scheduled + on-demand)
 *   - Deployment (on main push)
 *   - Custom jobs (triggered by Cozanet OS)
 */
export class GitHubActionsConfig {
  private workflows: Map<string, GitHubActionsWorkflow> = new Map();

  constructor() {
    this.defineWorkflows();
  }

  // ── Generate YAML for a workflow ─────────────────────────────────
  generateYaml(workflowId: string): string {
    const wf = this.workflows.get(workflowId);
    if (!wf) throw new Error(`Workflow not found: ${workflowId}`);

    const lines: string[] = [`name: ${wf.name}`, ''];

    // Trigger
    lines.push('on:');
    switch (wf.trigger.kind) {
      case 'push':
        lines.push('  push:');
        lines.push(`    branches: [${wf.trigger.branches.join(', ')}]`);
        break;
      case 'pull_request':
        lines.push('  pull_request:');
        lines.push(`    branches: [${wf.trigger.branches.join(', ')}]`);
        break;
      case 'schedule':
        lines.push('  schedule:');
        lines.push(`    - cron: "${wf.trigger.cron}"`);
        break;
      case 'workflow_dispatch':
        lines.push('  workflow_dispatch:');
        if (wf.trigger.inputs) {
          lines.push('    inputs:');
          for (const [key, val] of Object.entries(wf.trigger.inputs)) {
            lines.push(`      ${key}:`);
            lines.push(`        description: "${val}"`);
            lines.push(`        required: true`);
          }
        }
        break;
      case 'on_release':
        lines.push('  release:');
        lines.push('    types: [published]');
        break;
    }
    lines.push('');

    // Permissions
    lines.push('permissions:');
    lines.push('  contents: read');
    lines.push('');

    // Jobs
    for (const job of wf.jobs) {
      lines.push(`jobs:`);
      lines.push(`  ${job.id}:`);
      lines.push(`    runs-on: ${job.runsOn}`);
      if (job.needs && job.needs.length > 0) {
        lines.push(`    needs: [${job.needs.join(', ')}]`);
      }
      lines.push(`    steps:`);
      for (const step of job.steps) {
        if (step.action) {
          lines.push(`      - name: ${step.name}`);
          lines.push(`        uses: ${step.action}`);
          if (step.with) {
            lines.push(`        with:`);
            for (const [k, v] of Object.entries(step.with)) {
              lines.push(`          ${k}: ${v}`);
            }
          }
        } else if (step.run) {
          lines.push(`      - name: ${step.name}`);
          if (step.if) lines.push(`        if: ${step.if}`);
          lines.push(`        run: |`);
          for (const line of step.run.split('\n')) {
            lines.push(`          ${line}`);
          }
        }
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  // ── Get all workflows ─────────────────────────────────────────────
  getWorkflows(): GitHubActionsWorkflow[] {
    return Array.from(this.workflows.values());
  }

  getWorkflow(id: string): GitHubActionsWorkflow | null {
    return this.workflows.get(id) ?? null;
  }

  updateStatus(id: string, status: GitHubActionsWorkflow['status'], runUrl?: string): void {
    const wf = this.workflows.get(id);
    if (wf) {
      wf.status = status;
      wf.lastRun = Date.now();
      wf.lastRunUrl = runUrl;
    }
  }

  getStats() {
    const all = Array.from(this.workflows.values());
    return {
      total: all.length,
      notRun: all.filter(w => w.status === 'not_run').length,
      success: all.filter(w => w.status === 'success').length,
      failed: all.filter(w => w.status === 'failure').length,
    };
  }

  // ── Predefined workflows ──────────────────────────────────────────
  private defineWorkflows(): void {
    // CI: Build + Test
    this.workflows.set('ci', {
      id: 'ci',
      name: 'CI — Build & Test',
      filename: 'ci.yml',
      trigger: { kind: 'push', branches: ['main', 'feat/*'] },
      status: 'not_run',
      jobs: [
        {
          id: 'build_and_test',
          name: 'Build & Test',
          runsOn: 'ubuntu-latest',
          steps: [
            { name: 'Checkout', action: 'actions/checkout@v4' },
            { name: 'Setup Node.js', action: 'actions/setup-node@v4', with: { 'node-version': '20' } },
            { name: 'Install dependencies', run: 'npm ci' },
            { name: 'Type check', run: 'npx tsc --noEmit' },
            { name: 'Run tests', run: 'npm test' },
          ],
        },
      ],
    });

    // Security scan
    this.workflows.set('security-scan', {
      id: 'security-scan',
      name: 'Security Scan',
      filename: 'security-scan.yml',
      trigger: { kind: 'schedule', cron: '0 6 * * *' },
      status: 'not_run',
      jobs: [
        {
          id: 'security',
          name: 'Security Audit',
          runsOn: 'ubuntu-latest',
          steps: [
            { name: 'Checkout', action: 'actions/checkout@v4' },
            { name: 'Setup Node.js', action: 'actions/setup-node@v4', with: { 'node-version': '20' } },
            { name: 'Install dependencies', run: 'npm ci' },
            { name: 'Run npm audit', run: 'npm audit --audit-level=moderate' },
            { name: 'Scan for secrets', run: 'npx tsx src/AEGIS/SecurityScanner.ts || true' },
          ],
        },
      ],
    });

    // Deploy
    this.workflows.set('deploy', {
      id: 'deploy',
      name: 'Deploy',
      filename: 'deploy.yml',
      trigger: { kind: 'push', branches: ['main'] },
      status: 'not_run',
      jobs: [
        {
          id: 'deploy',
          name: 'Deploy to Vercel',
          runsOn: 'ubuntu-latest',
          steps: [
            { name: 'Checkout', action: 'actions/checkout@v4' },
            { name: 'Setup Node.js', action: 'actions/setup-node@v4', with: { 'node-version': '20' } },
            { name: 'Install Vercel CLI', run: 'npm i -g vercel' },
            { name: 'Deploy', run: 'vercel --prod --token=${{ secrets.VERCEL_TOKEN }} --yes' },
          ],
        },
      ],
    });

    // Custom job (triggered by Cozanet OS)
    this.workflows.set('cozanet-job', {
      id: 'cozanet-job',
      name: 'Cozanet OS Job',
      filename: 'cozanet-job.yml',
      trigger: { kind: 'workflow_dispatch', inputs: { task: 'Task description' } },
      status: 'not_run',
      jobs: [
        {
          id: 'run-task',
          name: 'Run Cozanet Task',
          runsOn: 'ubuntu-latest',
          steps: [
            { name: 'Checkout', action: 'actions/checkout@v4' },
            { name: 'Setup Node.js', action: 'actions/setup-node@v4', with: { 'node-version': '20' } },
            { name: 'Install dependencies', run: 'npm ci' },
            { name: 'Run task', run: 'echo "Running: ${{ inputs.task }}"\nnpx tsx src/index.ts' },
          ],
        },
      ],
    });
  }
}
