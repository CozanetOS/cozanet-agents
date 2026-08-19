import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';
import { GitHubClient } from './GitHubClient';
import {
  RepoInfo, RepoFile, FileContent, IssueInfo, PullRequestInfo,
  CommitInfo, WorkflowRun, CreateIssueInput, CreatePRInput, CreateBranchInput,
} from './types';

/**
 * GitHubAgent — GitHub Engine for CozanetOS (Phase 3).
 *
 * Per build spec Section 45 (GitHub-First Development):
 *   "A missing laptop must not become a bottleneck to progress."
 *
 * Capabilities:
 *  - List & browse repositories
 *  - Read files from any repo
 *  - Create, list, comment, close issues
 *  - Create branches, PRs, merge PRs
 *  - Monitor GitHub Actions / CI status
 *  - List commits
 *
 * Uses GITHUB_TOKEN from environment. No external deps.
 *
 * Integration point: cozanet-github engine.
 */
export class GitHubAgent extends BaseAgent {
  public client: GitHubClient;

  constructor() {
    super('agent:github', 'GitHub Agent', 'Repository Browsing, Issues, PRs & CI Monitoring');

    this.registerCapability({
      name: 'github',
      description: 'Browse repos, read files, manage issues, create/merge PRs, monitor GitHub Actions',
      taskTypes: [
        // Connection
        'check_connection', 'set_token',
        // Repositories
        'list_repos', 'list_org_repos', 'get_repo',
        // Files
        'list_contents', 'get_file', 'get_readme',
        // Commits
        'list_commits',
        // Issues
        'list_issues', 'get_issue', 'create_issue', 'close_issue', 'comment_issue',
        // Pull requests
        'list_prs', 'get_pr', 'create_pr', 'merge_pr', 'create_branch',
        // GitHub Actions
        'list_workflow_runs', 'get_workflow_run', 'rerun_workflow', 'get_ci_status',
      ],
    });

    this.client = new GitHubClient();
  }

  protected onStart(): void {
    const configured = this.client.isConfigured();
    console.log(`[${this.id}] GitHub Agent online — token ${configured ? 'configured ✓' : 'NOT SET ⚠'}`);
  }

  public async handle(task: AgentTask): Promise<any> {
    switch (task.type) {
      // ── Connection ────────────────────────────────────────────────
      case 'check_connection':
        return this.checkConnection();
      case 'set_token':
        this.client.setToken(task.input.token);
        if (task.input.owner) this.client.setOwner(task.input.owner);
        return { configured: true };

      // ── Repositories ──────────────────────────────────────────────
      case 'list_repos':
        return this.client.listRepositories(task.input.perPage ?? 30);
      case 'list_org_repos':
        return this.client.listOrgRepositories(task.input.org, task.input.perPage ?? 30);
      case 'get_repo':
        return this.client.getRepository(task.input.owner, task.input.repo);

      // ── Files ─────────────────────────────────────────────────────
      case 'list_contents':
        return this.client.listContents(task.input.owner, task.input.repo, task.input.path ?? '', task.input.ref);
      case 'get_file':
        return this.client.getFile(task.input.owner, task.input.repo, task.input.path, task.input.ref);
      case 'get_readme':
        return this.client.getReadme(task.input.owner, task.input.repo);

      // ── Commits ───────────────────────────────────────────────────
      case 'list_commits':
        return this.client.listCommits(task.input.owner, task.input.repo, task.input.perPage ?? 10, task.input.branch);

      // ── Issues ───────────────────────────────────────────────────
      case 'list_issues':
        return this.client.listIssues(task.input.owner, task.input.repo, task.input.state ?? 'open', task.input.perPage ?? 30);
      case 'get_issue':
        return this.client.getIssue(task.input.owner, task.input.repo, task.input.number);
      case 'create_issue':
        return this.client.createIssue(task.input as CreateIssueInput);
      case 'close_issue':
        return this.client.closeIssue(task.input.owner, task.input.repo, task.input.number);
      case 'comment_issue':
        return this.client.commentIssue(task.input.owner, task.input.repo, task.input.number, task.input.body);

      // ── Pull Requests ────────────────────────────────────────────
      case 'list_prs':
        return this.client.listPullRequests(task.input.owner, task.input.repo, task.input.state ?? 'open', task.input.perPage ?? 30);
      case 'get_pr':
        return this.client.getPullRequest(task.input.owner, task.input.repo, task.input.number);
      case 'create_pr':
        return this.client.createPullRequest(task.input as CreatePRInput);
      case 'merge_pr':
        return this.client.mergePullRequest(
          task.input.owner, task.input.repo, task.input.number,
          task.input.method ?? 'squash', task.input.commitTitle,
        );
      case 'create_branch':
        return this.client.createBranch(task.input as CreateBranchInput);

      // ── GitHub Actions / CI ──────────────────────────────────────
      case 'list_workflow_runs':
        return this.client.listWorkflowRuns(task.input.owner, task.input.repo, task.input.perPage ?? 10, task.input.branch);
      case 'get_workflow_run':
        return this.client.getWorkflowRun(task.input.owner, task.input.repo, task.input.runId);
      case 'rerun_workflow':
        return this.client.reRunWorkflow(task.input.owner, task.input.repo, task.input.runId);
      case 'get_ci_status':
        return this.client.getCIStatus(task.input.owner, task.input.repo, task.input.ref);

      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  // ── Connection check ──────────────────────────────────────────────
  private async checkConnection(): Promise<{ configured: boolean; user?: string; ok: boolean }> {
    if (!this.client.isConfigured()) {
      return { configured: false, ok: false };
    }
    try {
      // GET /user is the simplest way to validate the token
      const res = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json',
        },
      });
      if (!res.ok) return { configured: true, ok: false };
      const data = await res.json() as any;
      return { configured: true, user: data.login, ok: true };
    } catch (err: any) {
      return { configured: true, ok: false };
    }
  }
}
