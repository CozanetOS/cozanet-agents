// ── DatabaseAgent — Real file-based persistent storage ───────────────
//
// v0.3.0 — All methods now use real file-based storage:
//  - query/insert/update/delete: Real CRUD on JSON files (one per table)
//  - transaction: Real multi-op with rollback support
//  - schema: Real schema introspection from stored data
//  - migrate: Real data migration between tables
//
// Uses a simple JSON file store in the data/ directory.
// For production, swap with Supabase/PostgreSQL via the cozanet-database engine.

import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface QueryResult {
  rows: Record<string, any>[];
  count: number;
  durationMs: number;
}

export interface SchemaInfo {
  tables: Array<{
    name: string;
    columns: Array<{ name: string; type: string; nullable: boolean }>;
    rowCount: number;
  }>;
}

interface StoredRecord {
  id: string;
  created_date: string;
  updated_date: string;
  created_by: string;
  [key: string]: any;
}

/**
 * DatabaseAgent — persistent storage with CRUD, transactions, and schema.
 * Uses file-based JSON storage that can be swapped for Supabase/PostgreSQL.
 */
export class DatabaseAgent extends BaseAgent {
  private dataDir: string;

  constructor(dataDir?: string) {
    super('agent:database', 'Database Agent', 'State Persistence & Data Management');
    this.dataDir = dataDir || path.join(process.cwd(), 'data');

    this.registerCapability({
      name: 'database',
      description: 'Query, insert, update, delete, and manage data with transactions',
      taskTypes: ['query', 'insert', 'update', 'delete', 'transaction', 'schema', 'migrate'],
    });
  }

  protected onStart(): void {
    // Ensure data directory exists
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    console.log(`[${this.id}] Database Agent online — file store at ${this.dataDir}`);
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
        return this.migrate(task.input.from, task.input.to, task.input.filter);
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  // ── Query (Real) ────────────────────────────────────────────────────

  public async query(
    table: string,
    filter?: Record<string, any>,
    options?: { limit?: number; sort?: string; skip?: number },
  ): Promise<QueryResult> {
    const start = Date.now();
    console.log(`[${this.id}] Query ${table}: ${JSON.stringify(filter || {})}`);

    let rows = this.readTable(table);

    // Apply filters
    if (filter) {
      rows = rows.filter(row => this.matchesFilter(row, filter));
    }

    // Apply sort
    if (options?.sort) {
      const sortField = options.sort.replace(/^-/, '');
      const descending = options.sort.startsWith('-');
      rows.sort((a, b) => {
        const av = a[sortField], bv = b[sortField];
        if (av < bv) return descending ? 1 : -1;
        if (av > bv) return descending ? -1 : 1;
        return 0;
      });
    }

    // Apply skip
    if (options?.skip) {
      rows = rows.slice(options.skip);
    }

    // Apply limit
    if (options?.limit) {
      rows = rows.slice(0, options.limit);
    }

    return { rows, count: rows.length, durationMs: Date.now() - start };
  }

  // ── Insert (Real) ───────────────────────────────────────────────────

  public async insert(table: string, record: Record<string, any>): Promise<{ table: string; id: string; inserted: boolean }> {
    console.log(`[${this.id}] Insert into ${table}`);

    const id = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const fullRecord: StoredRecord = {
      id,
      created_date: now,
      updated_date: now,
      created_by: 'system',
      ...record,
    };

    const rows = this.readTable(table);
    rows.push(fullRecord);
    this.writeTable(table, rows);

    return { table, id, inserted: true };
  }

  // ── Update (Real) ───────────────────────────────────────────────────

  public async update(
    table: string,
    filter: Record<string, any>,
    updates: Record<string, any>,
  ): Promise<{ table: string; updated: number }> {
    console.log(`[${this.id}] Update ${table}: ${JSON.stringify(filter)}`);

    const rows = this.readTable(table);
    let updatedCount = 0;
    const now = new Date().toISOString();

    for (let i = 0; i < rows.length; i++) {
      if (this.matchesFilter(rows[i], filter)) {
        rows[i] = { ...rows[i], ...updates, updated_date: now };
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      this.writeTable(table, rows);
    }

    return { table, updated: updatedCount };
  }

  // ── Delete (Real) ───────────────────────────────────────────────────

  public async delete(table: string, filter: Record<string, any>): Promise<{ table: string; deleted: number }> {
    console.log(`[${this.id}] Delete from ${table}: ${JSON.stringify(filter)}`);

    const rows = this.readTable(table);
    const remaining = rows.filter(row => !this.matchesFilter(row, filter));
    const deletedCount = rows.length - remaining.length;

    if (deletedCount > 0) {
      this.writeTable(table, remaining);
    }

    return { table, deleted: deletedCount };
  }

  // ── Transaction (Real with rollback) ────────────────────────────────

  public async transaction(
    operations: Array<{ type: string; table: string; data: any; filter?: any }>,
  ): Promise<{ committed: boolean; results: any[]; rolledBack?: boolean }> {
    console.log(`[${this.id}] Transaction with ${operations.length} operations`);

    // Snapshot all affected tables for rollback
    const snapshots = new Map<string, StoredRecord[]>();
    for (const op of operations) {
      if (!snapshots.has(op.table)) {
        snapshots.set(op.table, this.readTable(op.table));
      }
    }

    const results: any[] = [];

    try {
      for (const op of operations) {
        let result;
        switch (op.type) {
          case 'insert':
            result = await this.insert(op.table, op.data);
            break;
          case 'update':
            result = await this.update(op.table, op.filter || {}, op.data);
            break;
          case 'delete':
            result = await this.delete(op.table, op.filter || {});
            break;
          default:
            throw new Error(`Unknown transaction op type: ${op.type}`);
        }
        results.push(result);
      }

      return { committed: true, results };
    } catch (err: any) {
      // Rollback: restore all snapshots
      console.warn(`[${this.id}] Transaction failed, rolling back: ${err.message}`);
      for (const [table, snapshot] of snapshots.entries()) {
        this.writeTable(table, snapshot);
      }
      return { committed: false, results, rolledBack: true };
    }
  }

  // ── Schema (Real introspection) ────────────────────────────────────

  public async schema(table?: string): Promise<SchemaInfo> {
    console.log(`[${this.id}] Schema for ${table || 'all tables'}`);

    const tables: SchemaInfo['tables'] = [];
    const tableNames = table ? [table] : this.listTables();

    for (const name of tableNames) {
      const rows = this.readTable(name);
      const columns = this.inferSchema(rows);
      tables.push({
        name,
        columns,
        rowCount: rows.length,
      });
    }

    return { tables };
  }

  // ── Migrate (Real) ───────────────────────────────────────────────────

  public async migrate(
    from: string,
    to: string,
    filter?: Record<string, any>,
  ): Promise<{ from: string; to: string; migrated: boolean; recordsMigrated: number }> {
    console.log(`[${this.id}] Migration: ${from} → ${to}`);

    const sourceRows = this.readTable(from);
    const toMigrate = filter ? sourceRows.filter(r => this.matchesFilter(r, filter)) : sourceRows;
    const targetRows = this.readTable(to);

    targetRows.push(...toMigrate);
    this.writeTable(to, targetRows);

    // Remove migrated records from source
    if (filter) {
      const remaining = sourceRows.filter(r => !this.matchesFilter(r, filter));
      this.writeTable(from, remaining);
    } else {
      this.writeTable(from, []);
    }

    return { from, to, migrated: true, recordsMigrated: toMigrate.length };
  }

  // ── File Store Helpers ──────────────────────────────────────────────

  private getTablePath(table: string): string {
    return path.join(this.dataDir, `${table}.json`);
  }

  private readTable(table: string): StoredRecord[] {
    const filePath = this.getTablePath(table);
    if (!fs.existsSync(filePath)) {
      return [];
    }
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  private writeTable(table: string, rows: StoredRecord[]): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    fs.writeFileSync(this.getTablePath(table), JSON.stringify(rows, null, 2));
  }

  private listTables(): string[] {
    if (!fs.existsSync(this.dataDir)) return [];
    return fs.readdirSync(this.dataDir)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  }

  private matchesFilter(record: Record<string, any>, filter: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(filter)) {
      if (record[key] !== value) return false;
    }
    return true;
  }

  private inferSchema(rows: StoredRecord[]): Array<{ name: string; type: string; nullable: boolean }> {
    if (rows.length === 0) return [];
    const sample = rows[0];
    const columns: Array<{ name: string; type: string; nullable: boolean }> = [];

    for (const [key, value] of Object.entries(sample)) {
      const type = Array.isArray(value) ? 'array'
        : value === null ? 'null'
        : typeof value;
      const nullable = rows.some(r => r[key] === null || r[key] === undefined);
      columns.push({ name: key, type, nullable });
    }

    return columns;
  }
}
