import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';

export interface EmailMessage {
  to: string;
  from: string;
  subject: string;
  body: string;
  html?: string;
  attachments?: string[];
  headers?: Record<string, string>;
  status: 'draft' | 'sent' | 'failed' | 'received';
  sentAt?: number;
}

export interface EmailSearchResult {
  messages: EmailMessage[];
  total: number;
  folder: string;
}

/**
 * EmailAgent — manages email composition, sending, receiving, and triage.
 * Integration point: cozanet-communication engine (Gmail, Outlook, SMTP).
 */
export class EmailAgent extends BaseAgent {
  constructor() {
    super('agent:email', 'Email Agent', 'Email Communication & Triage');

    this.registerCapability({
      name: 'email',
      description: 'Send, receive, search, and triage email messages',
      taskTypes: ['send', 'receive', 'search', 'draft', 'reply', 'forward', 'triage'],
    });
  }

  protected onStart(): void {
    console.log(`[${this.id}] Email Agent online — managing email.`);
  }

  public async handle(task: AgentTask): Promise<any> {
    switch (task.type) {
      case 'send':
        return this.send(task.input.to, task.input.subject, task.input.body, task.input.html, task.input.attachments);
      case 'receive':
        return this.receive(task.input.folder, task.input.limit);
      case 'search':
        return this.search(task.input.query, task.input.folder);
      case 'draft':
        return this.draft(task.input.to, task.input.subject, task.input.body);
      case 'reply':
        return this.reply(task.input.messageId, task.input.body);
      case 'forward':
        return this.forward(task.input.messageId, task.input.to);
      case 'triage':
        return this.triage(task.input.messages);
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  private async send(to: string, subject: string, body: string, html?: string, attachments?: string[]): Promise<{ sent: boolean; messageId: string; to: string }> {
    console.log(`[${this.id}] Sending email to ${to}: "${subject}"`);
    // Integration point: cozanet-communication SMTP/Gmail/Outlook
    return { sent: true, messageId: `email:${Date.now()}`, to };
  }

  private async receive(folder = 'inbox', limit = 20): Promise<EmailSearchResult> {
    console.log(`[${this.id}] Fetching from ${folder}`);
    return { messages: [], total: 0, folder };
  }

  private async search(query: string, folder?: string): Promise<EmailSearchResult> {
    console.log(`[${this.id}] Searching emails: "${query}"`);
    return { messages: [], total: 0, folder: folder || 'all' };
  }

  private async draft(to: string, subject: string, body: string): Promise<EmailMessage> {
    console.log(`[${this.id}] Drafting email to ${to}`);
    return { to, from: 'user@cozanet.os', subject, body, status: 'draft' };
  }

  private async reply(messageId: string, body: string): Promise<{ replied: boolean; messageId: string }> {
    console.log(`[${this.id}] Replying to ${messageId}`);
    return { replied: true, messageId: `reply:${Date.now()}` };
  }

  private async forward(messageId: string, to: string): Promise<{ forwarded: boolean; messageId: string }> {
    console.log(`[${this.id}] Forwarding ${messageId} to ${to}`);
    return { forwarded: true, messageId: `fwd:${Date.now()}` };
  }

  private async triage(messages: EmailMessage[]): Promise<{ categories: Record<string, EmailMessage[]>; priorities: Record<string, string> }> {
    console.log(`[${this.id}] Triaging ${messages.length} messages`);
    return {
      categories: { urgent: [], important: [], normal: [], spam: [] },
      priorities: {},
    };
  }
}
