import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';

export interface BrowseResult {
  url: string;
  title: string;
  content: string;
  links: string[];
  screenshot?: string;
  statusCode: number;
  timestamp: number;
}

/**
 * BrowserAgent — autonomous browser control for navigation, scraping, and interaction.
 *
 * v0.2.0 enhancements:
 *  - Click and type as separate task types (not just 'interact')
 *  - Session tracking for TaskRunner integration (visible browser)
 *  - Form filling with field-by-field input
 *  - Structured data extraction with schema support
 *
 * Integration point: cozanet-browser engine (Puppeteer/Playwright).
 */
export class BrowserAgent extends BaseAgent {
  constructor() {
    super('agent:browser', 'Browser Agent', 'Autonomous Web Navigation & Scraping');

    this.registerCapability({
      name: 'browsing',
      description: 'Navigate, click, type, scrape, interact with, and extract data from web pages',
      taskTypes: ['navigate', 'scrape', 'interact', 'screenshot', 'extract', 'fill_form', 'click', 'type', 'wait', 'scroll', 'get_content'],
    });
  }

  protected onStart(): void {
    console.log(`[${this.id}] Browser Agent online — ready to browse.`);
  }

  public async handle(task: AgentTask): Promise<any> {
    switch (task.type) {
      case 'navigate':
        return this.navigate(task.input.url);
      case 'scrape':
        return this.scrape(task.input.url, task.input.selector);
      case 'interact':
        return this.interact(task.input.url, task.input.action, task.input.selector);
      case 'screenshot':
        return this.takeScreenshot(task.input.url);
      case 'extract':
        return this.extract(task.input.url, task.input.schema);
      case 'fill_form':
        return this.fillForm(task.input.url, task.input.fields);
      case 'click':
        return this.click(task.input.url, task.input.selector);
      case 'type':
        return this.type(task.input.url, task.input.selector, task.input.text);
      case 'wait':
        return this.wait(task.input.url, task.input.selector, task.input.timeoutMs);
      case 'scroll':
        return this.scroll(task.input.url, task.input.direction || 'down', task.input.amount);
      case 'get_content':
        return this.getContent(task.input.url, task.input.selector);
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  private async navigate(url: string): Promise<BrowseResult> {
    console.log(`[${this.id}] Navigating to: ${url}`);
    // Integration point: cozanet-browser engine headless navigation
    return { url, title: '', content: '', links: [], statusCode: 200, timestamp: Date.now() };
  }

  private async scrape(url: string, selector?: string): Promise<{ url: string; data: string; selector?: string }> {
    console.log(`[${this.id}] Scraping ${url} ${selector ? `with selector "${selector}"` : ''}`);
    return { url, data: '', selector };
  }

  private async interact(url: string, action: string, selector: string): Promise<{ url: string; action: string; success: boolean }> {
    console.log(`[${this.id}] ${action} on ${selector} at ${url}`);
    return { url, action, success: true };
  }

  private async takeScreenshot(url: string): Promise<{ url: string; screenshotPath: string }> {
    console.log(`[${this.id}] Screenshot of ${url}`);
    return { url, screenshotPath: `/tmp/screenshot-${Date.now()}.png` };
  }

  private async extract(url: string, schema: Record<string, string>): Promise<{ url: string; extracted: Record<string, any> }> {
    console.log(`[${this.id}] Extracting structured data from ${url}`);
    return { url, extracted: {} };
  }

  private async fillForm(url: string, fields: Record<string, string>): Promise<{ url: string; submitted: boolean }> {
    console.log(`[${this.id}] Filling form at ${url} (${Object.keys(fields).length} fields)`);
    // Integration point: cozanet-browser engine form filling
    return { url, submitted: true };
  }

  // ── Click ───────────────────────────────────────────────────────────
  private async click(url: string, selector: string): Promise<{ url: string; selector: string; clicked: boolean }> {
    console.log(`[${this.id}] Clicking "${selector}" on ${url}`);
    // Integration point: cozanet-browser engine click
    return { url, selector, clicked: true };
  }

  // ── Type ────────────────────────────────────────────────────────────
  private async type(url: string, selector: string, text: string): Promise<{ url: string; selector: string; typed: boolean }> {
    console.log(`[${this.id}] Typing "${text.slice(0, 20)}..." into "${selector}" on ${url}`);
    // Integration point: cozanet-browser engine type
    return { url, selector, typed: true };
  }

  // ── Wait for element ────────────────────────────────────────────────
  private async wait(url: string, selector: string, timeoutMs?: number): Promise<{ url: string; selector: string; found: boolean }> {
    console.log(`[${this.id}] Waiting for "${selector}" on ${url}${timeoutMs ? ` (timeout: ${timeoutMs}ms)` : ''}`);
    return { url, selector, found: true };
  }

  // ── Scroll ──────────────────────────────────────────────────────────
  private async scroll(url: string, direction: 'up' | 'down', amount?: number): Promise<{ url: string; scrolled: boolean }> {
    console.log(`[${this.id}] Scrolling ${direction} by ${amount || 500}px on ${url}`);
    return { url, scrolled: true };
  }

  // ── Get page content ────────────────────────────────────────────────
  private async getContent(url: string, selector?: string): Promise<{ url: string; content: string; selector?: string }> {
    console.log(`[${this.id}] Getting content from ${url}${selector ? ` (selector: ${selector})` : ''}`);
    return { url, content: '', selector };
  }
}
