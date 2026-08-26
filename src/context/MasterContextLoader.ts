import * as fs from 'fs';
import * as path from 'path';

/**
 * Master Context Loader
 *
 * Loads the CozyCrypto Personal AI Master Context document into the CozanetOS
 * agent framework. This gives all agents shared access to the user's identity,
 * projects, architecture decisions, working style, and operating principles.
 *
 * The master context is a 60K character, 126-section document that serves as
 * the durable operating context for the entire agent system.
 *
 * Usage:
 *   const ctx = MasterContextLoader.load();
 *   const section = MasterContextLoader.getSection('AEGIS');
 *   const principle = MasterContextLoader.getArchitectureDecision('Vault Engine');
 */

const CONTEXT_FILE = path.join(__dirname, 'MASTER_CONTEXT.md');

export class MasterContextLoader {
  private static cache: string | null = null;
  private static parsed: Map<string, string> = new Map();

  /**
   * Load the full master context document.
   */
  static load(): string {
    if (this.cache) return this.cache;
    try {
      this.cache = fs.readFileSync(CONTEXT_FILE, 'utf-8');
      this.parseSections(this.cache);
    } catch {
      this.cache = '';
      this.parsed.clear();
    }
    return this.cache;
  }

  /**
   * Get a specific section by heading keyword.
   * e.g., getSection('AEGIS') returns everything under "# 4. AEGIS"
   */
  static getSection(keyword: string): string | null {
    if (this.parsed.size === 0) this.load();
    const key = keyword.toLowerCase();
    for (const [heading, content] of this.parsed.entries()) {
      if (heading.toLowerCase().includes(key)) {
        return content;
      }
    }
    return null;
  }

  /**
   * Get all section headings.
   */
  static getHeadings(): string[] {
    if (this.parsed.size === 0) this.load();
    return Array.from(this.parsed.keys());
  }

  /**
   * Search the full context for a keyword/phrase.
   */
  static search(query: string): { section: string; excerpt: string }[] {
    const full = this.load();
    const q = query.toLowerCase();
    const results: { section: string; excerpt: string }[] = [];

    for (const [heading, content] of this.parsed.entries()) {
      if (content.toLowerCase().includes(q)) {
        // Find the line with the match and grab context around it
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(q)) {
            const start = Math.max(0, i - 2);
            const end = Math.min(lines.length, i + 3);
            results.push({
              section: heading,
              excerpt: lines.slice(start, end).join('\n'),
            });
            break;
          }
        }
      }
    }

    return results;
  }

  /**
   * Get a summary of key architecture decisions.
   */
  static getArchitectureDecisions(): { decision: string; detail: string }[] {
    const decisions: { decision: string; detail: string }[] = [];

    const vaultDecision = this.getSection('WALLET ARCHITECTURE');
    if (vaultDecision) {
      decisions.push({
        decision: 'Vault Engine is preferred wallet architecture',
        detail: 'Remove HMAC wallet derivation from UI. UI obtains wallet info via Identity Engine → Vault Engine.',
      });
    }

    const autonomyDecision = this.getSection('AUTONOMY MODEL');
    if (autonomyDecision) {
      decisions.push({
        decision: 'Autonomous but not unsupervised',
        detail: 'AI can plan and act, but user retains control over sensitive production operations.',
      });
    }

    return decisions;
  }

  /**
   * Get the user's core operating principles (the 15-principle constitution).
   */
  static getConstitution(): string | null {
    return this.getSection('PERSONAL AI "CONSTITUTION"') || this.getSection('CONSTITUTION');
  }

  /**
   * Get current priorities.
   */
  static getPriorities(): string | null {
    return this.getSection('CURRENT HIGH-LEVEL PRIORITIES');
  }

  /**
   * Get the project map appendix.
   */
  static getProjectMap(): string | null {
    return this.getSection('PROJECT MAP') || this.getSection('APPENDIX A');
  }

  /**
   * Check if a proposed action conflicts with any architecture decision.
   * Returns conflicts found, or empty array if none.
   */
  static checkArchitectureConflict(proposal: string): string[] {
    const conflicts: string[] = [];
    const q = proposal.toLowerCase();

    // Check for wallet architecture conflicts
    if ((q.includes('hmac') || q.includes('wallet derivation')) && !q.includes('vault')) {
      conflicts.push('Conflicts with decision: Vault Engine is preferred — remove HMAC wallet derivation from UI.');
    }

    // Check for custody conflicts
    if (q.includes('custod') && q.includes('user funds')) {
      conflicts.push('Conflicts with principle: Non-custodial orientation — avoid taking custody of user funds.');
    }

    // Check for bypass attempts
    if (q.includes('bypass') && q.includes('gateway')) {
      conflicts.push('Conflicts with rule: Do not bypass the AEGIS Gateway.');
    }

    // Check for secret exposure
    if (q.includes('client-side') && (q.includes('private key') || q.includes('secret'))) {
      conflicts.push('Conflicts with security rule: Never place privileged keys in client-side code.');
    }

    return conflicts;
  }

  /**
   * Parse the markdown document into sections by heading.
   */
  private static parseSections(content: string): void {
    const lines = content.split('\n');
    let currentHeading = '';
    let currentContent: string[] = [];

    for (const line of lines) {
      if (line.startsWith('# ') || line.startsWith('## ')) {
        if (currentHeading) {
          this.parsed.set(currentHeading, [currentHeading, ...currentContent].join('\n').trim());
        }
        currentHeading = line.replace(/^#+\s*/, '');
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    if (currentHeading) {
      this.parsed.set(currentHeading, [currentHeading, ...currentContent].join('\n').trim());
    }
  }
}
