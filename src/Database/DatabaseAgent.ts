import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';

export interface QueryResult {
  rows: Record<string, any>[];
  count: number;
  durationMs: number;
}

export interface SchemaInfo {
  tables: { name: string; columns: { name: string; type: string; nullable: boolean }[] }[];
}

/**
 * DatabaseAgent — state transactions, configuration storage, and semantic search.
 * Provides a unified interface for all database operations across the OS.
 * Integration point: cozanet-database engine.
 */
export class DatabaseAgent extends BaseAgent {
  constructor() {
    super('agent:database', 'Database Agent', 'State Persistence & Data Management');

    this.registerCapability({
      name: 'database',
      description: 'Query, insert, update, delete, and manage data with transactions',
      taskTypes: ['query', 'insert', 'update', 'delete', 'transaction', 'schema', 'migrate'],
    });
  }

  protected onStart(): void {
    console.log(`[${this.id}] Database Agent online — managing data.`);
  }

  public async handle(task: AgentTask): Promise<any> {
    switch (task.type) {
      case 'query':
        return this.query(task.input.table, task.input.filter, task.input.options);
      case 'insert':
        return this.insert(task.input.table, task.input.record);
      case 'update':
        return this.update(task.input.table, task.input.filter, task.input.updates);
      case 'delete':
        return this.delete(task.input.table, task.input.filter);
      case 'transaction':
        return this.transaction(task.input.operations);
      case 'schema':
        return this.schema(task.input.table);
      case 'migrate':
        return this.migrate(task.input.from, task.input.to);
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  private async query(table: string, filter: Record<string, any>, options?: { limit?: number; sort?: string }): Promise<QueryResult> {
    console.log(`[${this.id}] Query ${table}: ${JSON.stringify(filter)}`);
    // Integration point: cozanet-database engine
    return { rows: [], count: 0, durationMs: 50 };
  }

  private async insert(table: string, record: Record<string, any>): Promise<{ table: string; id: string; inserted: boolean }> {
    console.log(`[${this.id}] Insert into ${table}`);
    return { table, id: `id:${Date.now()}`, inserted: true };
  }

  private async update(table: string, filter: Record<string, any>, updates: Record<string, any>): Promise<{ table: string; updated: number }> {
    console.log(`[${this.id}] Update ${table}: ${JSON.stringify(filter)}`);
    return { table, updated: 1 };
  }

  private async delete(table: string, filter: Record<string, any>): Promise<{ table: string; deleted: number }> {
    console.log(`[${this.id}] Delete from ${table}: ${JSON.stringify(filter)}`);
    return { table, deleted: 1 };
  }

  private async transaction(operations: { type: string; table: string; data: any }[]): Promise<{ committed: boolean; results: any[] }> {
    console.log(`[${this.id}] Transaction with ${operations.length} operations`);
    // Integration point: cozanet-database transaction support
    return { committed: true, results: [] };
  }

  private async schema(table?: string): Promise<SchemaInfo> {
    console.log(`[${this.id}] Schema for ${table || 'all tables'}`);
    return { tables: [] };
  }

  private async migrate(from: string, to: string): Promise<{ from: string; to: string; migrated: boolean; recordsMigrated: number }> {
    console.log(`[${this.id}] Migration: ${from} → ${to}`);
    return { from, to, migrated: true, recordsMigrated: 0 };
  }
}
