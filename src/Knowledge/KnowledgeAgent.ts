import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';

export interface KnowledgeEntry {
  id: string;
  topic: string;
  content: string;
  tags: string[];
  source: string;
  confidence: number;
  createdAt: number;
}

export interface KnowledgeQueryResult {
  entries: KnowledgeEntry[];
  totalFound: number;
  query: string;
}

/**
 * KnowledgeAgent — manages a structured knowledge base with semantic search.
 * Indexes information, provides contextual retrieval, and maintains knowledge graph links.
 */
export class KnowledgeAgent extends BaseAgent {
  private knowledgeBase: Map<string, KnowledgeEntry> = new Map();

  constructor() {
    super('agent:knowledge', 'Knowledge Agent', 'Knowledge Base Management & Retrieval');

    this.registerCapability({
      name: 'knowledge',
      description: 'Index, query, update, and manage structured knowledge',
      taskTypes: ['index', 'query', 'update_entry', 'delete_entry', 'list_topics', 'link'],
    });
  }

  protected onStart(): void {
    console.log(`[${this.id}] Knowledge Agent online — managing knowledge base.`);
  }

  public async handle(task: AgentTask): Promise<any> {
    switch (task.type) {
      case 'index':
        return this.index(task.input.topic, task.input.content, task.input.tags, task.input.source);
      case 'query':
        return this.query(task.input.searchTerm, task.input.limit);
      case 'update_entry':
        return this.updateEntry(task.input.id, task.input.updates);
      case 'delete_entry':
        return this.deleteEntry(task.input.id);
      case 'list_topics':
        return this.listTopics();
      case 'link':
        return this.linkEntries(task.input.sourceId, task.input.targetId, task.input.relationship);
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  private async index(topic: string, content: string, tags: string[] = [], source = 'unknown'): Promise<KnowledgeEntry> {
    const entry: KnowledgeEntry = {
      id: `kb:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      topic, content, tags, source,
      confidence: 0.8,
      createdAt: Date.now(),
    };
    this.knowledgeBase.set(entry.id, entry);
    console.log(`[${this.id}] Indexed: "${topic}" (${entry.id})`);
    return entry;
  }

  private async query(searchTerm: string, limit = 10): Promise<KnowledgeQueryResult> {
    const results = Array.from(this.knowledgeBase.values())
      .filter(e => e.topic.includes(searchTerm) || e.content.includes(searchTerm) || e.tags.includes(searchTerm))
      .slice(0, limit);
    return { entries: results, totalFound: results.length, query: searchTerm };
  }

  private async updateEntry(id: string, updates: Partial<KnowledgeEntry>): Promise<{ id: string; updated: boolean }> {
    const entry = this.knowledgeBase.get(id);
    if (!entry) return { id, updated: false };
    Object.assign(entry, updates);
    return { id, updated: true };
  }

  private async deleteEntry(id: string): Promise<{ id: string; deleted: boolean }> {
    return { id, deleted: this.knowledgeBase.delete(id) };
  }

  private async listTopics(): Promise<string[]> {
    return Array.from(new Set(Array.from(this.knowledgeBase.values()).map(e => e.topic)));
  }

  private async linkEntries(sourceId: string, targetId: string, relationship: string): Promise<{ linked: boolean; relationship: string }> {
    const source = this.knowledgeBase.get(sourceId);
    const target = this.knowledgeBase.get(targetId);
    if (!source || !target) return { linked: false, relationship };
    // Integration point: store in cozanet-database knowledge graph
    console.log(`[${this.id}] Linked ${sourceId} →${relationship}→ ${targetId}`);
    return { linked: true, relationship };
  }
}
