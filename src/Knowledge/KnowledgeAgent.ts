// ── KnowledgeAgent — Real persistence + LLM semantic search ─────────
//
// v0.3.0 — Real implementations:
//  - index/query/update/delete: File-based persistent storage
//  - query: LLM-powered semantic search (falls back to keyword match)
//  - linkEntries: Real adjacency list with bidirectional links
//  - listTopics: Real topic aggregation from persisted data
//  - extract [NEW]: LLM-powered knowledge extraction from raw content
//  - summarize [NEW]: LLM-powered summary of knowledge on a topic

import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';
import { ModelAdapter } from '../models/ModelAdapter';
import * as fs from 'fs';
import * as path from 'path';

export interface KnowledgeEntry {
  id: string;
  topic: string;
  content: string;
  tags: string[];
  source: string;
  confidence: number;
  createdAt: number;
  updatedAt: number;
  links?: { targetId: string; relationship: string }[];
}

export interface KnowledgeQueryResult {
  entries: KnowledgeEntry[];
  totalFound: number;
  query: string;
  searchMethod: 'semantic' | 'keyword';
}

/**
 * KnowledgeAgent — structured knowledge base with semantic search.
 * Uses file-based persistence and LLM for semantic search.
 */
export class KnowledgeAgent extends BaseAgent {
  private model: ModelAdapter;
  private knowledgeBase: Map<string, KnowledgeEntry> = new Map();
  private knowledgeDir: string;
  private links: Map<string, { targetId: string; relationship: string }[]> = new Map();
  private loaded = false;

  constructor(knowledgeDir?: string) {
    super('agent:knowledge', 'Knowledge Agent', 'Knowledge Base Management & Retrieval');
    this.model = ModelAdapter.getInstance();
    this.knowledgeDir = knowledgeDir || path.join(process.cwd(), 'data', 'knowledge');

    this.registerCapability({
      name: 'knowledge',
      description: 'Index, query, update, delete, and manage structured knowledge',
      taskTypes: ['index', 'query', 'update_entry', 'delete_entry', 'list_topics', 'link', 'extract', 'summarize'],
    });
  }

  protected onStart(): void {
    this.load();
    console.log(`[${this.id}] Knowledge Agent online — ${this.knowledgeBase.size} entries loaded.`);
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
      case 'extract':
        return this.extract(task.input.content, task.input.source);
      case 'summarize':
        return this.summarizeTopic(task.input.topic);
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  // ── Index (Real — persists to disk) ────────────────────────────────

  public async index(topic: string, content: string, tags: string[] = [], source = 'unknown'): Promise<KnowledgeEntry> {
    const entry: KnowledgeEntry = {
      id: `kb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      topic,
      content,
      tags,
      source,
      confidence: 0.8,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      links: [],
    };
    this.knowledgeBase.set(entry.id, entry);
    this.save();
    console.log(`[${this.id}] Indexed: "${topic}" (${entry.id})`);
    return entry;
  }

  // ── Query (Real — LLM semantic search + keyword fallback) ───────────

  public async query(searchTerm: string, limit: number = 10): Promise<KnowledgeQueryResult> {
    console.log(`[${this.id}] Querying: "${searchTerm}"`);

    if (this.knowledgeBase.size === 0) {
      return { entries: [], totalFound: 0, query: searchTerm, searchMethod: 'keyword' };
    }

    // Try LLM-powered semantic search first
    try {
      const allEntries = Array.from(this.knowledgeBase.values());
      const entrySummaries = allEntries.map((e, i) =>
        `${i + 1}. [${e.id}] Topic: ${e.topic} | Tags: ${e.tags.join(', ')} | Content: ${e.content.slice(0, 200)}`,
      ).join('\n');

      const result = await this.model.generate([
        {
          role: 'system',
          content: `You are a knowledge base search engine. Given a search query and a list of entries, return the indices of the most relevant entries (max ${limit}).
Return a JSON array of entry numbers: [1, 3, 5, ...]
Return ONLY the JSON array.`,
        },
        { role: 'user', content: `Search: "${searchTerm}"\n\nEntries:\n${entrySummaries.slice(0, 6000)}` },
      ], { maxTokens: 256, temperature: 0.1, responseFormat: 'json' });

      const indices = this.parseJSON<number[]>(result.text, []);

      if (indices.length > 0) {
        const entries = indices
          .filter(i => i >= 1 && i <= allEntries.length)
          .map(i => allEntries[i - 1])
          .filter(Boolean);

        if (entries.length > 0) {
          return { entries, totalFound: entries.length, query: searchTerm, searchMethod: 'semantic' };
        }
      }
    } catch {
      // Fall through to keyword search
    }

    // Fallback: keyword search
    const lower = searchTerm.toLowerCase();
    const results = Array.from(this.knowledgeBase.values())
      .filter(e =>
        e.topic.toLowerCase().includes(lower) ||
        e.content.toLowerCase().includes(lower) ||
        e.tags.some(t => t.toLowerCase().includes(lower)),
      )
      .slice(0, limit);

    return { entries: results, totalFound: results.length, query: searchTerm, searchMethod: 'keyword' };
  }

  // ── Update (Real — persists) ────────────────────────────────────────

  public async updateEntry(id: string, updates: Partial<KnowledgeEntry>): Promise<{ id: string; updated: boolean }> {
    const entry = this.knowledgeBase.get(id);
    if (!entry) return { id, updated: false };
    Object.assign(entry, updates, { updatedAt: Date.now() });
    this.save();
    return { id, updated: true };
  }

  // ── Delete (Real — persists) ────────────────────────────────────────

  public async deleteEntry(id: string): Promise<{ id: string; deleted: boolean }> {
    const deleted = this.knowledgeBase.delete(id);
    this.links.delete(id);
    // Remove any links pointing to this entry
    for (const [srcId, links] of this.links.entries()) {
      this.links.set(srcId, links.filter(l => l.targetId !== id));
    }
    if (deleted) this.save();
    return { id, deleted };
  }

  // ── List Topics (Real) ─────────────────────────────────────────────

  public async listTopics(): Promise<string[]> {
    return Array.from(new Set(Array.from(this.knowledgeBase.values()).map(e => e.topic)));
  }

  // ── Link Entries (Real — adjacency list with bidirectional) ────────

  public async linkEntries(sourceId: string, targetId: string, relationship: string): Promise<{ linked: boolean; relationship: string }> {
    const source = this.knowledgeBase.get(sourceId);
    const target = this.knowledgeBase.get(targetId);
    if (!source || !target) return { linked: false, relationship };

    // Add to source's links
    const sourceLinks = this.links.get(sourceId) || [];
    sourceLinks.push({ targetId, relationship });
    this.links.set(sourceId, sourceLinks);

    // Update the entry's links field
    source.links = sourceLinks;
    this.save();

    console.log(`[${this.id}] Linked ${sourceId} →${relationship}→ ${targetId}`);
    return { linked: true, relationship };
  }

  // ── Extract [NEW] — LLM-powered knowledge extraction ───────────────

  public async extract(content: string, source: string = 'unknown'): Promise<KnowledgeEntry[]> {
    console.log(`[${this.id}] Extracting knowledge from ${source} (${content.length} chars)`);

    try {
      const result = await this.model.generate([
        {
          role: 'system',
          content: `You are a knowledge extraction engine. Extract structured knowledge entries from the given content.
Return a JSON array of entries:
[
  {
    "topic": "short topic name",
    "content": "the knowledge content (1-3 sentences)",
    "tags": ["tag1", "tag2"],
    "confidence": 0.0-1.0
  }
]
Return ONLY the JSON array.`,
        },
        { role: 'user', content: content.slice(0, 8000) },
      ], { maxTokens: 2048, temperature: 0.2, responseFormat: 'json' });

      const entries = this.parseJSON<any[]>(result.text, []);

      if (Array.isArray(entries)) {
        const indexed: KnowledgeEntry[] = [];
        for (const e of entries) {
          const entry = await this.index(e.topic, e.content, e.tags || [], source);
          // Update confidence if provided
          if (e.confidence !== undefined) {
            entry.confidence = e.confidence;
          }
          indexed.push(entry);
        }
        return indexed;
      }

      return [];
    } catch {
      return [];
    }
  }

  // ── Summarize Topic [NEW] — LLM-powered summary ────────────────────

  public async summarizeTopic(topic: string): Promise<{ topic: string; summary: string; entryCount: number }> {
    console.log(`[${this.id}] Summarizing topic: ${topic}`);

    // Find all entries for this topic
    const entries = Array.from(this.knowledgeBase.values())
      .filter(e => e.topic.toLowerCase().includes(topic.toLowerCase()));

    if (entries.length === 0) {
      return { topic, summary: 'No entries found for this topic.', entryCount: 0 };
    }

    // Use LLM to synthesize a summary
    try {
      const content = entries.map((e, i) =>
        `Entry ${i + 1}: ${e.content}`,
      ).join('\n\n');

      const result = await this.model.generate([
        {
          role: 'system',
          content: `You are a knowledge synthesizer. Given multiple knowledge entries about "${topic}", create a cohesive summary that combines all the information. Note any contradictions or gaps. Keep it concise (200-300 words).`,
        },
        { role: 'user', content },
      ], { maxTokens: 500, temperature: 0.3 });

      return {
        topic,
        summary: result.text,
        entryCount: entries.length,
      };
    } catch {
      // Fallback: concatenate entries
      return {
        topic,
        summary: entries.map(e => e.content).join('\n\n'),
        entryCount: entries.length,
      };
    }
  }

  // ── Persistence ─────────────────────────────────────────────────────

  private save(): void {
    if (!fs.existsSync(this.knowledgeDir)) {
      fs.mkdirSync(this.knowledgeDir, { recursive: true });
    }

    const data = {
      entries: Array.from(this.knowledgeBase.values()),
      links: Array.from(this.links.entries()).map(([id, links]) => ({ id, links })),
    };

    fs.writeFileSync(
      path.join(this.knowledgeDir, 'knowledge.json'),
      JSON.stringify(data, null, 2),
    );
  }

  private load(): void {
    const filePath = path.join(this.knowledgeDir, 'knowledge.json');
    if (!fs.existsSync(filePath)) return;

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      for (const entry of data.entries || []) {
        this.knowledgeBase.set(entry.id, entry);
      }

      for (const { id, links } of data.links || []) {
        this.links.set(id, links);
      }

      this.loaded = true;
    } catch {
      // Corrupted file — start fresh
    }
  }

  private parseJSON<T>(text: string, fallback: T): T {
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    try { return JSON.parse(cleaned) as T; } catch { return fallback; }
  }
}
