import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';

export interface IntegrationConfig {
  id: string;
  name: string;
  type: string;
  authMethod: 'oauth' | 'api_key' | 'basic' | 'none';
  status: 'connected' | 'disconnected' | 'error';
  endpoints: { name: string; method: string; path: string }[];
  lastSync?: number;
  credentials?: {
    apiKey?: string;
    apiSecret?: string;
    token?: string;
    refreshToken?: string;
    username?: string;
    password?: string;
  };
  health?: {
    lastChecked: number;
    healthy: boolean;
    latencyMs?: number;
    errorRate: number;
  };
  metadata?: Record<string, any>;
}

export interface IntegrationCallResult {
  integration: string;
  endpoint: string;
  status: number;
  data: any;
  durationMs: number;
}

/**
 * IntegrationAgent — manages third-party integrations and external service connections.
 *
 * v0.2.0 enhancements:
 *  - Credential storage (API keys, tokens, OAuth refresh tokens)
 *  - Health checks — test if an integration is reachable and responsive
 *  - Update credentials without reconnecting
 *  - Get credentials for use by other agents
 *  - Error rate tracking
 *
 * Integration point: cozanet-communication engine, cozanet-identity engine.
 */
export class IntegrationAgent extends BaseAgent {
  private integrations: Map<string, IntegrationConfig> = new Map();

  constructor() {
    super('agent:integration', 'Integration Agent', 'Third-Party Integrations & Webhooks');

    this.registerCapability({
      name: 'integration',
      description: 'Connect, configure, sync, and manage external service integrations with credential vault',
      taskTypes: ['connect', 'disconnect', 'call', 'list_integrations', 'webhook_register', 'sync', 'get_credentials', 'update_credentials', 'health_check', 'list_by_type'],
    });
  }

  protected onStart(): void {
    console.log(`[${this.id}] Integration Agent online — connecting services.`);
  }

  public async handle(task: AgentTask): Promise<any> {
    switch (task.type) {
      case 'connect':
        return this.connect(task.input.name, task.input.type, task.input.authMethod, task.input.credentials, task.input.endpoints);
      case 'disconnect':
        return this.disconnect(task.input.integrationId);
      case 'call':
        return this.call(task.input.integrationId, task.input.endpoint, task.input.method, task.input.body);
      case 'list_integrations':
        return this.listIntegrations();
      case 'webhook_register':
        return this.registerWebhook(task.input.integrationId, task.input.url, task.input.events);
      case 'sync':
        return this.sync(task.input.integrationId);
      case 'get_credentials':
        return this.getCredentials(task.input.integrationId);
      case 'update_credentials':
        return this.updateCredentials(task.input.integrationId, task.input.credentials);
      case 'health_check':
        return this.healthCheck(task.input.integrationId);
      case 'list_by_type':
        return this.listByType(task.input.type);
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  private async connect(
    name: string,
    type: string,
    authMethod: IntegrationConfig['authMethod'],
    credentials?: IntegrationConfig['credentials'],
    endpoints?: { name: string; method: string; path: string }[]
  ): Promise<IntegrationConfig> {
    const config: IntegrationConfig = {
      id: `int:${type}:${Date.now()}`,
      name, type, authMethod,
      status: 'connected',
      endpoints: endpoints || [],
      lastSync: Date.now(),
      credentials,
      health: {
        lastChecked: Date.now(),
        healthy: true,
        errorRate: 0,
      },
    };
    this.integrations.set(config.id, config);
    console.log(`[${this.id}] Connected integration: ${name} (${type}) — auth: ${authMethod}`);
    return config;
  }

  private async disconnect(integrationId: string): Promise<{ integrationId: string; disconnected: boolean }> {
    const integ = this.integrations.get(integrationId);
    if (integ) integ.status = 'disconnected';
    return { integrationId, disconnected: !!integ };
  }

  private async call(integrationId: string, endpoint: string, method: string, body?: any): Promise<IntegrationCallResult> {
    const integ = this.integrations.get(integrationId);
    if (!integ || integ.status !== 'connected') {
      throw new Error(`Integration ${integrationId} not connected`);
    }
    const startTime = Date.now();
    console.log(`[${this.id}] Calling ${integ.name}/${endpoint} (${method})`);

    // Integration point: use credentials to make authenticated API call
    // e.g., add Authorization header from credentials.token or credentials.apiKey
    return { integration: integ.name, endpoint, status: 200, data: {}, durationMs: Date.now() - startTime };
  }

  private async listIntegrations(): Promise<IntegrationConfig[]> {
    return Array.from(this.integrations.values());
  }

  private async registerWebhook(integrationId: string, url: string, events: string[]): Promise<{ integrationId: string; webhookId: string; registered: boolean }> {
    console.log(`[${this.id}] Registering webhook for ${integrationId}: ${url} (events: ${events.join(', ')})`);
    return { integrationId, webhookId: `hook:${Date.now()}`, registered: true };
  }

  private async sync(integrationId: string): Promise<{ integrationId: string; synced: boolean; itemsSynced: number }> {
    const integ = this.integrations.get(integrationId);
    if (!integ) return { integrationId, synced: false, itemsSynced: 0 };
    integ.lastSync = Date.now();
    console.log(`[${this.id}] Syncing ${integ.name}...`);
    return { integrationId, synced: true, itemsSynced: 0 };
  }

  // ── Credential Management ──────────────────────────────────────────

  private getCredentials(integrationId: string): IntegrationConfig['credentials'] | null {
    const integ = this.integrations.get(integrationId);
    if (!integ) return null;
    return integ.credentials || null;
  }

  private updateCredentials(integrationId: string, credentials: IntegrationConfig['credentials']): { integrationId: string; updated: boolean } {
    const integ = this.integrations.get(integrationId);
    if (!integ) return { integrationId, updated: false };
    integ.credentials = { ...integ.credentials, ...credentials };
    console.log(`[${this.id}] Updated credentials for ${integ.name}`);
    return { integrationId, updated: true };
  }

  // ── Health Check ────────────────────────────────────────────────────

  private async healthCheck(integrationId: string): Promise<{ integrationId: string; healthy: boolean; latencyMs: number; status: string }> {
    const integ = this.integrations.get(integrationId);
    if (!integ) return { integrationId, healthy: false, latencyMs: 0, status: 'not_found' };

    const startTime = Date.now();
    let healthy = false;
    let status = 'error';

    try {
      // Integration point: make a lightweight test call to the service
      // e.g., GET /health or similar
      healthy = integ.status === 'connected';
      status = healthy ? 'healthy' : 'disconnected';
    } catch {
      healthy = false;
      status = 'error';
    }

    const latencyMs = Date.now() - startTime;

    integ.health = {
      lastChecked: Date.now(),
      healthy,
      latencyMs,
      errorRate: healthy ? 0 : 1,
    };

    return { integrationId, healthy, latencyMs, status };
  }

  // ── List by Type ────────────────────────────────────────────────────

  private listByType(type: string): IntegrationConfig[] {
    return Array.from(this.integrations.values()).filter(i => i.type === type);
  }
}
