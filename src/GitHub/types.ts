// ── Shared types for GitHub Engine ──────────────────────────────────────

export interface RepoInfo {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  description: string | null;
  private: boolean;
  fork: boolean;
  defaultBranch: string;
  url: string;
  cloneUrl: string;
  stars: number;
  forks: number;
  openIssues: number;
  language: string | null;
  updatedAt: string;
}

export interface RepoFile {
  path: string;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  size: number;
  sha: string;
  url: string;
}

export interface FileContent {
  path: string;
  sha: string;
  content: string;
  encoding: string;
  size: number;
}

export interface IssueInfo {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  author: string;
  labels: string[];
  assignees: string[];
  createdAt: string;
  updatedAt: string;
  url: string;
}

export interface PullRequestInfo {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  merged: boolean;
  draft: boolean;
  head: string; // branch name
  base: string;  // target branch
  author: string;
  createdAt: string;
  updatedAt: string;
  mergeable: boolean | null;
  url: string;
}

export interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  authorEmail: string;
  date: string;
  url: string;
}

export interface WorkflowRun {
  id: number;
  name: string;
  workflowId: number;
  status: 'queued' | 'in_progress' | 'completed' | 'requested' | 'waiting' | 'pending';
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | 'action_required' | 'neutral' | null;
  branch: string;
  event: string;
  createdAt: string;
  updatedAt: string;
  url: string;
  htmlUrl: string;
}

export interface CreateIssueInput {
  owner: string;
  repo: string;
  title: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
}

export interface CreatePRInput {
  owner: string;
  repo: string;
  title: string;
  head: string;
  base: string;
  body?: string;
  draft?: boolean;
}

export interface CreateBranchInput {
  owner: string;
  repo: string;
  branchName: string;
  fromBranch?: string; // defaults to default branch
}

export interface GitHubConfig {
  token: string;
  owner?: string; // default owner/org
  apiBase?: string; // default: https://api.github.com
}
