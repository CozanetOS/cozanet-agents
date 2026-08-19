import {
  RepoInfo, RepoFile, FileContent, IssueInfo, PullRequestInfo,
  CommitInfo, WorkflowRun, CreateIssueInput, CreatePRInput, CreateBranchInput,
  GitHubConfig,
} from './types';

/**
 * GitHubClient — thin HTTP wrapper around the GitHub REST API.
 *
 * Uses fetch (available in Node 18+ and browsers). No external deps.
 * Token comes from GITHUB_TOKEN env var or GitHubConfig.token.
 */
export class GitHubClient {
  private token: string;
  private apiBase: string;
  private owner: string | null;

  constructor(config?: Partial<GitHubConfig>) {
    this.token = config?.token ?? process.env.GITHUB_TOKEN ?? '';
    this.apiBase = config?.apiBase ?? 'https://api.github.com';
    this.owner = config?.owner ?? null;
  }

  setToken(token: string): void {
    this.token = token;
  }

  setOwner(owner: string): void {
    this.owner = owner;
  }

  isConfigured(): boolean {
    return this.token.length > 0;
  }

  // ── HTTP helper ────────────────────────────────────────────────────
  private async request<T = any>(
    method: string,
    path: string,
    body?: any,
    params?: Record<string, string>
  ): Promise<T> {
    if (!this.isConfigured()) {
      throw new Error('GitHub token not configured. Set GITHUB_TOKEN or call setToken().');
    }

    let url = `${this.apiBase}${path}`;
    if (params) {
      const qs = new URLSearchParams(params).toString();
      url += `?${qs}`;
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`GitHub API ${method} ${path} failed: ${res.status} ${res.statusText} — ${errBody.slice(0, 500)}`);
    }

    // 204 No Content
    if (res.status === 204) return undefined as T;

    return res.json() as Promise<T>;
  }

  // ── Repository browsing ────────────────────────────────────────────

  async listRepositories(perPage = 30): Promise<RepoInfo[]> {
    const data = await this.request<any[]>('GET', '/user/repos', undefined, {
      sort: 'updated',
      per_page: String(perPage),
    });
    return data.map(this.mapRepo);
  }

  async listOrgRepositories(org: string, perPage = 30): Promise<RepoInfo[]> {
    const data = await this.request<any[]>('GET', `/orgs/${org}/repos`, undefined, {
      sort: 'updated',
      per_page: String(perPage),
    });
    return data.map(this.mapRepo);
  }

  async getRepository(owner: string, repo: string): Promise<RepoInfo> {
    const data = await this.request<any>('GET', `/repos/${owner}/${repo}`);
    return this.mapRepo(data);
  }

  // ── File reading ───────────────────────────────────────────────────

  async listContents(owner: string, repo: string, path = '', ref?: string): Promise<RepoFile[]> {
    const params: Record<string, string> = {};
    if (ref) params.ref = ref;
    const data = await this.request<any[]>('GET', `/repos/${owner}/${repo}/contents/${path}`, undefined, params);
    return data.map((item: any) => ({
      path: item.path,
      type: item.type,
      size: item.size,
      sha: item.sha,
      url: item.html_url ?? item.url,
    }));
  }

  async getFile(owner: string, repo: string, path: string, ref?: string): Promise<FileContent> {
    const params: Record<string, string> = {};
    if (ref) params.ref = ref;
    const data = await this.request<any>('GET', `/repos/${owner}/${repo}/contents/${path}`, undefined, params);

    // If it's a directory, GitHub returns an array
    if (Array.isArray(data)) {
      throw new Error(`"${path}" is a directory, not a file. Use listContents() instead.`);
    }

    // Content may be base64 encoded
    let content = data.content ?? '';
    if (data.encoding === 'base64') {
      content = Buffer.from(content, 'base64').toString('utf-8');
    }

    return {
      path: data.path,
      sha: data.sha,
      content,
      encoding: data.encoding ?? 'utf-8',
      size: data.size,
    };
  }

  async getReadme(owner: string, repo: string): Promise<FileContent> {
    const data = await this.request<any>('GET', `/repos/${owner}/${repo}/readme`);
    let content = data.content ?? '';
    if (data.encoding === 'base64') {
      content = Buffer.from(content, 'base64').toString('utf-8');
    }
    return {
      path: data.path,
      sha: data.sha,
      content,
      encoding: data.encoding ?? 'utf-8',
      size: data.size,
    };
  }

  // ── Commits ─────────────────────────────────────────────────────────

  async listCommits(owner: string, repo: string, perPage = 10, branch?: string): Promise<CommitInfo[]> {
    const params: Record<string, string> = { per_page: String(perPage) };
    if (branch) params.sha = branch;
    const data = await this.request<any[]>('GET', `/repos/${owner}/${repo}/commits`, undefined, params);
    return data.map((c: any) => ({
      sha: c.sha,
      message: c.commit.message,
      author: c.commit.author?.name ?? 'unknown',
      authorEmail: c.commit.author?.email ?? '',
      date: c.commit.author?.date ?? '',
      url: c.html_url,
    }));
  }

  // ── Issues ──────────────────────────────────────────────────────────

  async listIssues(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open', perPage = 30): Promise<IssueInfo[]> {
    const data = await this.request<any[]>('GET', `/repos/${owner}/${repo}/issues`, undefined, {
      state,
      per_page: String(perPage),
    });
    // Filter out PRs (GitHub returns them in the issues endpoint)
    return data.filter((i: any) => !i.pull_request).map(this.mapIssue);
  }

  async getIssue(owner: string, repo: string, number: number): Promise<IssueInfo> {
    const data = await this.request<any>('GET', `/repos/${owner}/${repo}/issues/${number}`);
    return this.mapIssue(data);
  }

  async createIssue(input: CreateIssueInput): Promise<IssueInfo> {
    const body: any = { title: input.title };
    if (input.body) body.body = input.body;
    if (input.labels) body.labels = input.labels;
    if (input.assignees) body.assignees = input.assignees;
    const data = await this.request<any>('POST', `/repos/${input.owner}/${input.repo}/issues`, body);
    return this.mapIssue(data);
  }

  async closeIssue(owner: string, repo: string, number: number): Promise<IssueInfo> {
    const data = await this.request<any>('PATCH', `/repos/${owner}/${repo}/issues/${number}`, { state: 'closed' });
    return this.mapIssue(data);
  }

  async commentIssue(owner: string, repo: string, number: number, body: string): Promise<{ id: number; url: string }> {
    const data = await this.request<any>('POST', `/repos/${owner}/${repo}/issues/${number}/comments`, { body });
    return { id: data.id, url: data.html_url };
  }

  // ── Pull Requests ──────────────────────────────────────────────────

  async listPullRequests(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open', perPage = 30): Promise<PullRequestInfo[]> {
    const data = await this.request<any[]>('GET', `/repos/${owner}/${repo}/pulls`, undefined, {
      state,
      per_page: String(perPage),
    });
    return data.map(this.mapPR);
  }

  async getPullRequest(owner: string, repo: string, number: number): Promise<PullRequestInfo> {
    const data = await this.request<any>('GET', `/repos/${owner}/${repo}/pulls/${number}`);
    return this.mapPR(data);
  }

  async createPullRequest(input: CreatePRInput): Promise<PullRequestInfo> {
    const body: any = {
      title: input.title,
      head: input.head,
      base: input.base,
    };
    if (input.body) body.body = input.body;
    if (input.draft) body.draft = true;
    const data = await this.request<any>('POST', `/repos/${input.owner}/${input.repo}/pulls`, body);
    return this.mapPR(data);
  }

  async mergePullRequest(owner: string, repo: string, number: number, method: 'merge' | 'squash' | 'rebase' = 'squash', commitTitle?: string): Promise<{ merged: boolean; sha: string }> {
    const body: any = { merge_method: method };
    if (commitTitle) body.commit_title = commitTitle;
    const data = await this.request<any>('PUT', `/repos/${owner}/${repo}/pulls/${number}/merge`, body);
    return { merged: data.merged, sha: data.sha };
  }

  async createBranch(input: CreateBranchInput): Promise<{ ref: string; sha: string }> {
    // Get the SHA of the source branch
    let sha: string;
    if (input.fromBranch) {
      const ref = await this.request<any>('GET', `/repos/${input.owner}/${input.repo}/git/refs/heads/${input.fromBranch}`);
      sha = ref.object.sha;
    } else {
      const repo = await this.getRepository(input.owner, input.repo);
      const ref = await this.request<any>('GET', `/repos/${input.owner}/${input.repo}/git/refs/heads/${repo.defaultBranch}`);
      sha = ref.object.sha;
    }

    const data = await this.request<any>('POST', `/repos/${input.owner}/${input.repo}/git/refs`, {
      ref: `refs/heads/${input.branchName}`,
      sha,
    });
    return { ref: data.ref, sha: data.object.sha };
  }

  // ── GitHub Actions ──────────────────────────────────────────────────

  async listWorkflowRuns(owner: string, repo: string, perPage = 10, branch?: string): Promise<WorkflowRun[]> {
    const params: Record<string, string> = { per_page: String(perPage) };
    if (branch) params.branch = branch;
    const data = await this.request<any>('GET', `/repos/${owner}/${repo}/actions/runs`, undefined, params);
    return (data.workflow_runs ?? []).map(this.mapRun);
  }

  async getWorkflowRun(owner: string, repo: string, runId: number): Promise<WorkflowRun> {
    const data = await this.request<any>('GET', `/repos/${owner}/${repo}/actions/runs/${runId}`);
    return this.mapRun(data);
  }

  async reRunWorkflow(owner: string, repo: string, runId: number): Promise<{ ok: boolean }> {
    await this.request('POST', `/repos/${owner}/${repo}/actions/runs/${runId}/rerun`);
    return { ok: true };
  }

  async getCIStatus(owner: string, repo: string, ref: string): Promise<{
    ref: string;
    checks: { name: string; status: string; conclusion: string | null; url: string }[];
    overall: 'success' | 'failure' | 'pending' | 'none';
  }> {
    const data = await this.request<any[]>('GET', `/repos/${owner}/${repo}/commits/${ref}/check-runs`);
    const checks = (data ?? []).map((c: any) => ({
      name: c.name,
      status: c.status,
      conclusion: c.conclusion,
      url: c.html_url,
    }));

    let overall: 'success' | 'failure' | 'pending' | 'none' = 'none';
    if (checks.length > 0) {
      const allDone = checks.every(c => c.status === 'completed');
      if (allDone) {
        overall = checks.every(c => c.conclusion === 'success') ? 'success' : 'failure';
      } else {
        overall = 'pending';
      }
    }

    return { ref, checks, overall };
  }

  // ── Mappers ─────────────────────────────────────────────────────────

  private mapRepo(r: any): RepoInfo {
    return {
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      owner: r.owner?.login ?? '',
      description: r.description,
      private: r.private,
      fork: r.fork,
      defaultBranch: r.default_branch,
      url: r.html_url,
      cloneUrl: r.clone_url,
      stars: r.stargazers_count,
      forks: r.forks_count,
      openIssues: r.open_issues_count,
      language: r.language,
      updatedAt: r.updated_at,
    };
  }

  private mapIssue(i: any): IssueInfo {
    return {
      id: i.id,
      number: i.number,
      title: i.title,
      body: i.body,
      state: i.state,
      author: i.user?.login ?? 'unknown',
      labels: (i.labels ?? []).map((l: any) => l.name ?? l),
      assignees: (i.assignees ?? []).map((a: any) => a.login),
      createdAt: i.created_at,
      updatedAt: i.updated_at,
      url: i.html_url,
    };
  }

  private mapPR(p: any): PullRequestInfo {
    return {
      id: p.id,
      number: p.number,
      title: p.title,
      body: p.body,
      state: p.state,
      merged: p.merged ?? false,
      draft: p.draft ?? false,
      head: p.head?.ref ?? '',
      base: p.base?.ref ?? '',
      author: p.user?.login ?? 'unknown',
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      mergeable: p.mergeable,
      url: p.html_url,
    };
  }

  private mapRun(r: any): WorkflowRun {
    return {
      id: r.id,
      name: r.name ?? r.display_title ?? 'unnamed',
      workflowId: r.workflow_id,
      status: r.status,
      conclusion: r.conclusion,
      branch: r.head_branch ?? '',
      event: r.event,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      url: r.url,
      htmlUrl: r.html_url,
    };
  }
}
