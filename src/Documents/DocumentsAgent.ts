import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';

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
 * Handles document templates, format conversion, and version history.
 * Integration point: cozanet-filesystem engine.
 */
export class DocumentsAgent extends BaseAgent {
  private documents: Map<string, DocumentInfo> = new Map();

  constructor() {
    super('agent:documents', 'Documents Agent', 'Document Management & Processing');

    this.registerCapability({
      name: 'documents',
      description: 'Create, convert, search, and manage documents',
      taskTypes: ['create', 'convert', 'search', 'summarize', 'template', 'list_documents'],
    });
  }

  protected onStart(): void {
    console.log(`[${this.id}] Documents Agent online — managing documents.`);
  }

  public async handle(task: AgentTask): Promise<any> {
    switch (task.type) {
      case 'create':
        return this.create(task.input.name, task.input.type, task.input.content);
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

  private async create(name: string, type: string, content: string): Promise<DocumentInfo> {
    const doc: DocumentInfo = {
      id: `doc:${Date.now()}`,
      name, type, size: content.length,
      path: `/documents/${name}`,
      createdAt: Date.now(),
      tags: [],
    };
    this.documents.set(doc.id, doc);
    console.log(`[${this.id}] Created document: ${name} (${type})`);
    return doc;
  }

  private async convert(documentId: string, toFormat: string): Promise<{ documentId: string; convertedTo: string; success: boolean }> {
    console.log(`[${this.id}] Converting ${documentId} → ${toFormat}`);
    return { documentId, convertedTo: toFormat, success: true };
  }

  private async search(query: string, limit = 20): Promise<{ results: DocumentInfo[]; query: string }> {
    const results = Array.from(this.documents.values())
      .filter(d => d.name.includes(query) || d.tags.includes(query))
      .slice(0, limit);
    return { results, query };
  }

  private async summarize(documentId: string): Promise<{ documentId: string; summary: string }> {
    console.log(`[${this.id}] Summarizing document: ${documentId}`);
    return { documentId, summary: 'Document summary...' };
  }

  private async applyTemplate(templateId: string, variables: Record<string, string>): Promise<{ templateId: string; rendered: string }> {
    console.log(`[${this.id}] Applying template ${templateId} with ${Object.keys(variables).length} vars`);
    return { templateId, rendered: 'Rendered template content...' };
  }

  private async listDocuments(): Promise<DocumentInfo[]> {
    return Array.from(this.documents.values());
  }
}
