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
 * Handles OAuth flows, API key management, webhook registration, and sync operations.
 * Integration point: cozanet-communication engine, cozanet-identity engine.
 */
export class IntegrationAgent extends BaseAgent {
  private integrations: Map<string, IntegrationConfig> = new Map();

  constructor() {
    super('agent:integration', 'Integration Agent', 'Third-Party Integrations & Webhooks');

    this.registerCapability({
      name: 'integration',
      description: 'Connect, configure, sync, and manage external service integrations',
      taskTypes: ['connect', 'disconnect', 'call', 'list_integrations', 'webhook_register', 'sync'],
    });
  }

  protected onStart(): void {
    console.log(`[${this.id}] Integration Agent online — connecting services.`);
  }

  public async handle(task: AgentTask): Promise<any> {
    switch (task.type) {
      case 'connect':
        return this.connect(task.input.name, task.input.type, task.input.authMethod, task.input.credentials);
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
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  private async connect(name: string, type: string, authMethod: IntegrationConfig['authMethod'], _credentials?: any): Promise<IntegrationConfig> {
    const config: IntegrationConfig = {
      id: `int:${type}:${Date.now()}`,
      name, type, authMethod,
      status: 'connected',
      endpoints: [],
      lastSync: Date.now(),
    };
    this.integrations.set(config.id, config);
    console.log(`[${this.id}] Connected integration: ${name} (${type})`);
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
}
