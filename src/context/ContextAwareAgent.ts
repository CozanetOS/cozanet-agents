import { ContextManager } from './ContextManager';

export abstract class ContextAwareAgent {
  protected context: string | null = null;
  protected domain: string;

  constructor(domain: string) {
    this.domain = domain;
  }

  protected loadContext(): string {
    if (!this.context) {
      this.context = ContextManager.loadDomainContext(this.domain);
    }
    return this.context;
  }

  public getContext(): string {
    return this.loadContext();
  }

  public refreshContext(): void {
    this.context = null;
  }
}
