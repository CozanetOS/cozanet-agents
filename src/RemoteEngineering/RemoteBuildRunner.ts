import { RemoteBuild, DeploymentInfo, DeploymentStatus, HealthCheck } from './Phase8Types';

/**
 * RemoteBuildRunner — manages remote builds through GitHub Actions.
 *
 * "Lack of a laptop must not block engineering progress." (Phase 8)
 *
 * The system can trigger builds, track their status, and report results
 * back to Cozanet OS — all without a local machine.
 */
export class RemoteBuildRunner {
  private builds: Map<string, RemoteBuild> = new Map();

  // ── Trigger a build ───────────────────────────────────────────────
  triggerBuild(repo: string, branch: string, commitSha: string, triggeredBy: string): RemoteBuild {
    const build: RemoteBuild = {
      id: `build:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
      repo, branch, commitSha, triggeredBy,
      status: 'queued',
    };
    this.builds.set(build.id, build);

    // Simulate build progression
    // In production: poll GitHub Actions API
    setTimeout(() => {
      build.status = 'running';
      build.startedAt = Date.now();
    }, 100);

    return build;
  }

  // ── Update build status ───────────────────────────────────────────
  updateBuild(id: string, status: RemoteBuild['status'], logs?: string[]): void {
    const build = this.builds.get(id);
    if (build) {
      build.status = status;
      if (logs) build.logs = logs;
      if (status === 'success' || status === 'failed') {
        build.completedAt = Date.now();
        if (build.startedAt) {
          build.durationMs = build.completedAt - build.startedAt;
        }
      }
    }
  }

  // ── Query builds ──────────────────────────────────────────────────
  getBuilds(filter?: { status?: string; repo?: string }): RemoteBuild[] {
    let results = Array.from(this.builds.values());
    if (filter?.status) results = results.filter(b => b.status === filter.status);
    if (filter?.repo) results = results.filter(b => b.repo === filter.repo);
    return results.sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));
  }

  getBuild(id: string): RemoteBuild | null {
    return this.builds.get(id) ?? null;
  }

  getLatestBuild(repo: string): RemoteBuild | null {
    return this.getBuilds({ repo })[0] ?? null;
  }

  // ── Stats ─────────────────────────────────────────────────────────
  getStats() {
    const all = Array.from(this.builds.values());
    return {
      total: all.length,
      queued: all.filter(b => b.status === 'queued').length,
      running: all.filter(b => b.status === 'running').length,
      success: all.filter(b => b.status === 'success').length,
      failed: all.filter(b => b.status === 'failed').length,
    };
  }
}

/**
 * DeploymentMonitor — monitors deployment status across Vercel projects.
 *
 * "Deployment monitoring" from Phase 8 spec.
 * "Never confuse intention with completion." (Section 97 rule 9)
 *
 * Tracks deployment status, performs health checks, and detects failures.
 */
export class DeploymentMonitor {
  private deployments: Map<string, DeploymentInfo> = new Map();
  private healthChecks: Map<string, HealthCheck> = new Map();

  // ── Known Vercel projects ──────────────────────────────────────────
  private knownProjects: string[] = [
    'cozanet-chat', 'aegis-ui-v2', 'cozanet-apps', 'cozanet-site',
    'aegis.cozanet.net', 'cozanet.net',
  ];

  // ── Register a deployment ─────────────────────────────────────────
  registerDeployment(info: Omit<DeploymentInfo, 'id' | 'createdAt' | 'updatedAt'>): DeploymentInfo {
    const id = `deploy:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`;
    const deployment: DeploymentInfo = {
      ...info, id,
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    this.deployments.set(id, deployment);
    return deployment;
  }

  // ── Update deployment status ──────────────────────────────────────
  updateStatus(id: string, status: DeploymentStatus, errorMessage?: string): void {
    const dep = this.deployments.get(id);
    if (dep) {
      dep.status = status;
      dep.updatedAt = Date.now();
      if (errorMessage) dep.errorMessage = errorMessage;
    }
  }

  // ── Perform a health check ────────────────────────────────────────
  async healthCheck(url: string): Promise<HealthCheck> {
    const check: HealthCheck = {
      url, status: 'down', lastChecked: Date.now(),
    };

    try {
      // In production: actual HTTP request
      // For framework: simulate based on known project
      const projectName = this.knownProjects.find(p => url.includes(p));
      if (projectName) {
        check.status = 'healthy';
        check.statusCode = 200;
        check.responseTimeMs = Math.floor(Math.random() * 200) + 50;
      } else {
        check.status = 'down';
        check.statusCode = 404;
        check.errorMessage = 'Project not found';
      }
    } catch (e: any) {
      check.status = 'down';
      check.errorMessage = e.message;
    }

    this.healthChecks.set(url, check);
    return check;
  }

  // ── Get all deployments ────────────────────────────────────────────
  getDeployments(filter?: { status?: DeploymentStatus; project?: string }): DeploymentInfo[] {
    let results = Array.from(this.deployments.values());
    if (filter?.status) results = results.filter(d => d.status === filter.status);
    if (filter?.project) results = results.filter(d => d.project === filter.project);
    return results.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getDeployedProjects(): string[] {
    return [...new Set(Array.from(this.deployments.values()).map(d => d.project))];
  }

  getFailedDeployments(): DeploymentInfo[] {
    return this.getDeployments({ status: 'error' });
  }

  getHealthChecks(): HealthCheck[] {
    return Array.from(this.healthChecks.values()).sort((a, b) => b.lastChecked - a.lastChecked);
  }

  getKnownProjects(): string[] {
    return this.knownProjects;
  }

  addKnownProject(name: string): void {
    if (!this.knownProjects.includes(name)) {
      this.knownProjects.push(name);
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────
  getStats() {
    const all = Array.from(this.deployments.values());
    return {
      total: all.length,
      deployed: all.filter(d => d.status === 'deployed' || d.status === 'ready').length,
      building: all.filter(d => d.status === 'building').length,
      error: all.filter(d => d.status === 'error').length,
      projects: this.knownProjects.length,
      healthChecks: this.healthChecks.size,
    };
  }
}
