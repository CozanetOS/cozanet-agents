// ── DocumentsAgent — Real file operations + LLM summarize ────────────
//
// v0.3.0 — Real implementations:
//  - create: Real file write to disk (was in-memory only)
//  - convert: Real format conversion (txt↔json↔csv↔md)
//  - search: Real full-text search across stored documents
//  - summarize: LLM-powered document summarization
//  - template: Real template variable substitution
//  - list: Real listing from disk

import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';
import { ModelAdapter } from '../models/ModelAdapter';
import * as fs from 'fs';
import * as path from 'path';

export interface DocumentInfo {
  id: string;
  name: string;
  type: string;
  size: number;
  path: string;
  createdAt: number;
  tags: string[];
}

/**
 * DocumentsAgent — document creation, management, conversion, and search.
 */
export class DocumentsAgent extends BaseAgent {
  private model: ModelAdapter;
  private documents: Map<string, DocumentInfo> = new Map();
  private docsDir: string;

  constructor(docsDir?: string) {
    super('agent:documents', 'Documents Agent', 'Document Management & Processing');
    this.model = ModelAdapter.getInstance();
    this.docsDir = docsDir || path.join(process.cwd(), 'data', 'documents');

    this.registerCapability({
      name: 'documents',
      description: 'Create, convert, search, and manage documents',
      taskTypes: ['create', 'convert', 'search', 'summarize', 'template', 'list_documents'],
    });
  }

  protected onStart(): void {
    if (!fs.existsSync(this.docsDir)) fs.mkdirSync(this.docsDir, { recursive: true });
    this.load();
    console.log(`[${this.id}] Documents Agent online — ${this.documents.size} documents.`);
  }

  public async handle(task: AgentTask): Promise<any> {
    switch (task.type) {
      case 'create':
        return this.create(task.input.name, task.input.type, task.input.content, task.input.tags);
      case 'convert':
        return this.convert(task.input.documentId, task.input.toFormat);
      case 'search':
        return this.search(task.input.query, task.input.limit);
      case 'summarize':
        return this.summarize(task.input.documentId);
      case 'template':
        return this.applyTemplate(task.input.templateId, task.input.variables);
      case 'list_documents':
        return this.listDocuments();
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  public async create(name: string, type: string, content: string, tags: string[] = []): Promise<DocumentInfo> {
    const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const filename = `${id}.${type}`;
    const filepath = path.join(this.docsDir, filename);

    fs.writeFileSync(filepath, content);

    const doc: DocumentInfo = {
      id, name, type, size: content.length,
      path: filepath, createdAt: Date.now(), tags,
    };
    this.documents.set(id, doc);
    this.save();
    console.log(`[${this.id}] Created document: ${name} (${type}, ${content.length} bytes)`);
    return doc;
  }

  public async convert(documentId: string, toFormat: string): Promise<{ documentId: string; convertedTo: string; success: boolean; newPath?: string }> {
    console.log(`[${this.id}] Converting ${documentId} → ${toFormat}`);
    const doc = this.documents.get(documentId);
    if (!doc) return { documentId, convertedTo: toFormat, success: false };

    try {
      const content = fs.readFileSync(doc.path, 'utf8');
      let converted = '';

      switch (toFormat) {
        case 'txt':
          converted = content.replace(/[#*`_\[\]()]/g, '').replace(/\n{3,}/g, '\n\n').trim();
          break;
        case 'json':
          converted = JSON.stringify({ name: doc.name, content, tags: doc.tags, createdAt: doc.createdAt }, null, 2);
          break;
        case 'csv':
          // Convert line-based content to CSV
          const lines = content.split('\n');
          converted = ['line,text', ...lines.map((l, i) => `${i},"${l.replace(/"/g, '""')}"`)].join('\n');
          break;
        case 'md':
          // Convert to markdown
          converted = `# ${doc.name}\n\n${content}\n\n---\nTags: ${doc.tags.join(', ')}`;
          break;
        default:
          converted = content; // No conversion needed
      }

      const newPath = path.join(this.docsDir, `${doc.id}.${toFormat}`);
      fs.writeFileSync(newPath, converted);

      return { documentId, convertedTo: toFormat, success: true, newPath };
    } catch (err: any) {
      return { documentId, convertedTo: toFormat, success: false };
    }
  }

  public async search(query: string, limit: number = 20): Promise<{ results: Array<{ id: string; name: string; snippet: string }>; total: number }> {
    console.log(`[${this.id}] Searching documents: "${query}"`);
    const lower = query.toLowerCase();
    const results: Array<{ id: string; name: string; snippet: string }> = [];

    for (const [id, doc] of this.documents.entries()) {
      try {
        const content = fs.readFileSync(doc.path, 'utf8').toLowerCase();
        if (doc.name.toLowerCase().includes(lower) || content.includes(lower)) {
          const idx = content.indexOf(lower);
          const snippet = fs.readFileSync(doc.path, 'utf8').slice(Math.max(0, idx - 50), idx + 100);
          results.push({ id, name: doc.name, snippet });
        }
      } catch { /* file may not exist */ }
    }

    return { results: results.slice(0, limit), total: results.length };
  }

  public async summarize(documentId: string): Promise<{ documentId: string; summary: string; wordCount: number }> {
    console.log(`[${this.id}] Summarizing ${documentId}`);
    const doc = this.documents.get(documentId);
    if (!doc) return { documentId, summary: 'Document not found', wordCount: 0 };

    try {
      const content = fs.readFileSync(doc.path, 'utf8');

      const result = await this.model.generate([
        {
          role: 'system',
          content: 'Summarize the following document in 2-3 concise paragraphs. Preserve key information. No filler.',
        },
        { role: 'user', content: content.slice(0, 10000) },
      ], { maxTokens: 500, temperature: 0.3 });

      return { documentId, summary: result.text, wordCount: result.text.split(/\s+/).length };
    } catch (err: any) {
      return { documentId, summary: `Summarization failed: ${err.message}`, wordCount: 0 };
    }
  }

  public async applyTemplate(templateId: string, variables: Record<string, string>): Promise<{ templateId: string; result: string }> {
    console.log(`[${this.id}] Applying template ${templateId}`);

    // Try to load template file
    const templatePath = path.join(this.docsDir, `template_${templateId}.md`);
    let template = '';

    try {
      template = fs.readFileSync(templatePath, 'utf8');
    } catch {
      // Built-in templates
      const builtins: Record<string, string> = {
        meeting: `# Meeting Notes: {{title}}\nDate: {{date}}\nAttendees: {{attendees}}\n\n## Agenda\n{{agenda}}\n\n## Action Items\n{{actions}}\n\n## Notes\n{{notes}}`,
        report: `# {{title}} Report\n\n## Summary\n{{summary}}\n\n## Findings\n{{findings}}\n\n## Recommendations\n{{recommendations}}`,
        proposal: `# Proposal: {{title}}\n\n## Problem\n{{problem}}\n\n## Solution\n{{solution}}\n\n## Timeline\n{{timeline}}\n\n## Budget\n{{budget}}`,
      };
      template = builtins[templateId] || `# {{title}}\n\n{{content}}`;
    }

    // Real variable substitution
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    return { templateId, result };
  }

  public async listDocuments(): Promise<DocumentInfo[]> {
    return Array.from(this.documents.values());
  }

  // ── Persistence ─────────────────────────────────────────────────────

  private save(): void {
    if (!fs.existsSync(this.docsDir)) fs.mkdirSync(this.docsDir, { recursive: true });
    const data = Array.from(this.documents.values());
    fs.writeFileSync(path.join(this.docsDir, 'index.json'), JSON.stringify(data, null, 2));
  }

  private load(): void {
    const filePath = path.join(this.docsDir, 'index.json');
    if (!fs.existsSync(filePath)) return;
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      for (const doc of data) {
        this.documents.set(doc.id, doc);
      }
    } catch { /* start fresh */ }
  }
}
