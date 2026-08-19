import { MasterContextLoader } from './MasterContextLoader';
import * as fs from 'fs';
import * as path from 'path';

/**
 * ContextManager — Domain-aware smart context loader.
 *
 * Instead of loading the full 60K master context document into every agent,
 * ContextManager loads ONLY the sections relevant to the active domain.
 *
 * This implements Section 58 of the Cozanet OS Build Specification:
 *   "Do not send all memory to the model.
 *    For an AEGIS wallet task, load AEGIS constitution, wallet architecture,
 *    current task, relevant code, relevant decisions, relevant tests.
 *    Do not load unrelated trading history."
 *
 * Domains (from build spec Section 6):
 *   1. Personal
 *   2. Cozanet Company
 *   3. AEGIS
 *   4. Cozanet AI
 *   5. Trading
 *   6. Research
 *   7. Engineering
 *   8. Security
 *   9. Funding
 *   10. Strategic Intelligence
 */

export interface DomainConfig {
  name: string;
  description: string;
  /** Section heading keywords from MASTER_CONTEXT.md */
  contextSections: string[];
  /** Section heading keywords from BUILD_SPECIFICATION.md */
  specSections: string[];
  /** Short system prompt for this domain */
  systemPrompt: string;
}

export class ContextManager {
  private static domains: Record<string, DomainConfig> = {
    Personal: {
      name: 'Personal',
      description: 'Identity, goals, preferences, working style, decisions, priorities',
      contextSections: [
        'IDENTITY AND CORE CONTEXT',
        'PERSONAL AI MEMORY MODEL',
        'HOW THE USER LIKES TO WORK',
        'HOW THE AI SHOULD RESPOND',
        'CURRENT HIGH-LEVEL PRIORITIES',
        'PERSONAL AI "CONSTITUTION"',
        'QUICK REFERENCE — WHO IS COZYCRYPTO',
        'FINAL OPERATING INSTRUCTION',
      ],
      specSections: ['PERSONAL DOMAIN', 'MEMORY SYSTEM', 'MEMORY TYPES'],
      systemPrompt: 'You are operating in the Personal domain. Focus on identity, goals, preferences, and personal context.',
    },

    'Cozanet Company': {
      name: 'Cozanet Company',
      description: 'Company info, ecosystem, CZN token, business development, Africa market',
      contextSections: [
        'COZANET',
        'COZANET TOKEN / DIGITAL ASSET CONTEXT',
        'BUSINESS / COMPANY DEVELOPMENT',
        'AFRICA AS THE CORE MARKET CONTEXT',
        'THE USER\'S LONG-TERM AMBITION',
        'WHAT THE PERSONAL AI SHOULD REMEMBER ABOUT COZANET',
        'DOMAIN / BRAND CONTEXT',
      ],
      specSections: ['COZANET COMPANY DOMAIN', 'COMPANY RADAR', 'COMPANY REPORTING'],
      systemPrompt: 'You are operating in the Cozanet Company domain. Focus on company operations, ecosystem, and business intelligence.',
    },

    AEGIS: {
      name: 'AEGIS',
      description: 'Financial infrastructure, smart routing, Vault Engine, Identity Engine, architecture rules',
      contextSections: [
        'AEGIS',
        'AEGIS AUTONOMY MODEL',
        'ARCHITECTURE GOVERNANCE',
        'AI CONSTRUCTION RULES',
        'WALLET ARCHITECTURE HISTORY',
        'IDENTITY ENGINE',
        'CURRENT ARCHITECTURAL DIRECTION',
        'WHAT THE PERSONAL AI SHOULD REMEMBER ABOUT AEGIS',
        'WHAT "SMART ROUTER" REALLY MEANS',
        'ERROR PHILOSOPHY',
        'FINANCIAL SAFETY',
      ],
      specSections: ['AEGIS DOMAIN', 'AEGIS ENGINEERING WORKFLOW', 'AEGIS ARCHITECTURE PROTECTION', 'WALLET ARCHITECTURE RULE'],
      systemPrompt: 'You are operating in the AEGIS domain. Protect architecture. Connect before rebuilding. Vault Engine is wallet source of truth.',
    },

    'Cozanet AI': {
      name: 'Cozanet AI',
      description: 'Agentic AI product, agent framework, model provider philosophy',
      contextSections: [
        'COZANET AI',
        'COZANET OS',
        'MODEL / AI PROVIDER PHILOSOPHY',
        'THE USER\'S VIEW OF AI',
        'PERSONAL SECOND-BRAIN REQUIREMENT',
        'WHAT THE PERSONAL AI SHOULD REMEMBER ABOUT COZANET AI',
        'WHAT THE PERSONAL AI SHOULD REMEMBER ABOUT COZANET OS',
        'MODEL AGNOSTICISM',
        'PROVIDER AGNOSTICISM',
      ],
      specSections: ['COZANET AI', 'ORCHESTRATOR', 'SPECIALIZED AGENT SKILLS', 'MODEL PROVIDER ABSTRACTION'],
      systemPrompt: 'You are operating in the Cozanet AI domain. Focus on agentic AI capabilities, model abstraction, and agent framework.',
    },

    Trading: {
      name: 'Trading',
      description: 'SMC, FVG, liquidity zones, order blocks, multi-timeframe trading',
      contextSections: [
        'TRADING',
        'TRADING AI ROLE',
      ],
      specSections: ['TRADING DOMAIN'],
      systemPrompt: 'You are operating in the Trading domain. SMC, FVG, liquidity zones, order blocks. Multi-timeframe: 1H trend, 15M context, 5M monitor, 3M entries. Never fabricate trade data.',
    },

    Research: {
      name: 'Research',
      description: 'Research workflows, source tracking, external information policy',
      contextSections: [
        'SEARCH AND RESEARCH',
        'WHEN DOING RESEARCH',
        'WHEN GIVING TECHNICAL ADVICE',
        'ANTI-REPETITION RULE',
      ],
      specSections: ['OPPORTUNITY ENGINE', 'EXTERNAL INFORMATION POLICY'],
      systemPrompt: 'You are operating in the Research domain. Verify sources, track confidence, never assume outdated info is current.',
    },

    Engineering: {
      name: 'Engineering',
      description: 'GitHub-first development, deployments, testing, build environment',
      contextSections: [
        'CURRENT BUILD ENVIRONMENT',
        'WORKING WITH GITHUB',
        'WORKING WITH DEPLOYMENTS',
        'WORKING WITH SUPABASE',
        'WORKING WITH FIREBASE',
        'USER\'S APPROACH TO TECHNOLOGY',
        'USER\'S RESOURCE-CONSCIOUS ENGINEERING',
        'MVP PHILOSOPHY',
        'INFRASTRUCTURE LEVERAGE',
      ],
      specSections: ['GITHUB-FIRST DEVELOPMENT', 'GITHUB ACTIONS AS REMOTE HANDS', 'TESTING', 'ARCHITECTURE TESTS'],
      systemPrompt: 'You are operating in the Engineering domain. GitHub-first. Test everything. Never confuse intention with completion.',
    },

    Security: {
      name: 'Security',
      description: 'Security rules, secrets management, wallet security, proactive flagging',
      contextSections: [
        'SECURITY HISTORY',
        'AI CONSTRUCTION RULES',
        'WALLET ARCHITECTURE HISTORY',
        'FINANCIAL SAFETY',
        'EXECUTION AUTHORITY',
        'MEMORY SAFETY',
      ],
      specSections: ['SECURITY RULES', 'SECURITY RADAR', 'PERMISSION MODEL', 'APPROVAL OBJECT'],
      systemPrompt: 'You are operating in the Security domain. Never expose secrets. Never put private keys client-side. Flag vulnerabilities proactively.',
    },

    Funding: {
      name: 'Funding',
      description: 'Grants, hackathons, accelerators, resource awareness',
      contextSections: [
        'FUNDING AND RESOURCE REALITY',
        'FUNDING STRATEGY',
        'STELLAR / SOROBAN CONTEXT',
        'BNB CHAIN CONTEXT',
        'USER\'S RESOURCE-CONSCIOUS ENGINEERING',
      ],
      specSections: ['FUNDING INTELLIGENCE', 'RESOURCE AWARENESS'],
      systemPrompt: 'You are operating in the Funding domain. Verify deadlines. Rank opportunities. Never assume an opportunity is open because it was previously open.',
    },

    'Strategic Intelligence': {
      name: 'Strategic Intelligence',
      description: 'Competitive intel, market trends, regulatory radar, opportunity engine',
      contextSections: [
        'IMPORTANT STRATEGIC REALIZATION',
        'STRATEGIC DISCIPLINE',
        'PROJECT PRIORITY HIERARCHY',
        'THE USER\'S "WHY"',
        'USER\'S CORE QUESTION PATTERN',
        'WHEN THE USER ASKS ABOUT A BUSINESS OPPORTUNITY',
        'LONG-TERM INFRASTRUCTURE MINDSET',
      ],
      specSections: ['COMPETITIVE INTELLIGENCE', 'TECHNOLOGY RADAR', 'REGULATORY RADAR', 'STRATEGIC REVIEW'],
      systemPrompt: 'You are operating in the Strategic Intelligence domain. Identify opportunities, risks, and strategic drift. Rank by relevance.',
    },
  };

  private static buildSpecCache: string | null = null;
  private static buildSpecSections: Map<string, string> = new Map();

  /**
   * Load relevant context sections for a specific domain.
   * Returns ONLY the relevant sections, NOT the full 60K document.
   */
  public static loadDomainContext(domain: string): string {
    const config = this.domains[domain];
    if (!config) {
      return this.loadMinimalContext('Personal');
    }

    const sections: string[] = [config.systemPrompt];

    for (const keyword of config.contextSections) {
      const section = MasterContextLoader.getSection(keyword);
      if (section && !sections.includes(section)) {
        sections.push(section);
      }
    }

    this.loadBuildSpec();
    for (const keyword of config.specSections) {
      const section = this.getBuildSpecSection(keyword);
      if (section && !sections.includes(section)) {
        sections.push(section);
      }
    }

    return sections.length > 1 ? sections.join('\n\n---\n\n') : config.systemPrompt;
  }

  /**
   * Load domain context PLUS additional sections matching task-specific keywords.
   */
  public static loadTaskContext(domain: string, taskKeywords: string[]): string {
    const base = this.loadDomainContext(domain);
    const extra: string[] = [];

    for (const kw of taskKeywords) {
      const section = MasterContextLoader.getSection(kw);
      if (section && !base.includes(section)) {
        extra.push(section);
      }
    }

    return extra.length > 0 ? `${base}\n\n---\n\n${extra.join('\n\n---\n\n')}` : base;
  }

  /**
   * Load just the system prompt + 2 most critical sections for a domain.
   */
  public static loadMinimalContext(domain: string): string {
    const config = this.domains[domain];
    if (!config) return '';

    const sections: string[] = [config.systemPrompt];
    for (let i = 0; i < Math.min(2, config.contextSections.length); i++) {
      const section = MasterContextLoader.getSection(config.contextSections[i]);
      if (section) sections.push(section);
    }
    return sections.join('\n\n');
  }

  /**
   * Detect which domain a user message relates to based on keyword scoring.
   */
  public static detectDomain(userMessage: string): string {
    const msg = userMessage.toLowerCase();
    const domainKeywords: Record<string, string[]> = {
      AEGIS: ['aegis', 'wallet', 'vault', 'routing', 'payment', 'stablecoin', 'mobile money', 'blockchain', 'identity engine', 'send money', 'usdt'],
      Trading: ['trade', 'trading', 'smc', 'fvg', 'liquidity', 'order block', 'ichimoku', 'scalp', 'chart', 'price action', 'timeframe'],
      Funding: ['grant', 'funding', 'hackathon', 'accelerator', 'investor', 'smedan', 'antler', 'bnb chain grant', 'stellar community', 'mvb'],
      Security: ['security', 'secret', 'vulnerability', 'cve', 'private key', 'credential', 'exposed', 'exploit'],
      Engineering: ['github', 'deploy', 'vercel', 'supabase', 'firebase', 'build', 'code', 'test', 'commit', 'pull request', 'bug', 'fix'],
      'Cozanet Company': ['cozanet', 'company', 'czn', 'token', 'business', 'partnership', 'market', 'africa', 'nigeria'],
      'Cozanet AI': ['cozanet ai', 'agent', 'orchestrator', 'model', 'groq', 'openai', 'anthropic', 'llm', 'ai provider'],
      Research: ['research', 'search', 'find', 'investigate', 'analyze', 'source', 'verify'],
      'Strategic Intelligence': ['strategy', 'competitor', 'opportunity', 'market trend', 'regulation', 'regulatory', 'intelligence', 'radar'],
      Personal: ['remember', 'continue', 'what did we', 'where were', 'priority', 'decision', 'goal', 'i ', 'me', 'my'],
    };

    let bestDomain = 'Personal';
    let bestScore = 0;

    for (const [domain, keywords] of Object.entries(domainKeywords)) {
      let score = 0;
      for (const kw of keywords) {
        if (msg.includes(kw)) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestDomain = domain;
      }
    }

    return bestDomain;
  }

  public static getDomainConfig(domain: string): DomainConfig | undefined {
    return this.domains[domain];
  }

  public static listDomains(): string[] {
    return Object.keys(this.domains);
  }

  // ── Build Specification Loading ──────────────────────────────────────

  private static loadBuildSpec(): void {
    if (this.buildSpecCache !== null) return;

    const candidatePaths = [
      path.join(__dirname, 'BUILD_SPECIFICATION.md'),
      path.join(__dirname, '../../context/BUILD_SPECIFICATION.md'),
      path.join(process.cwd(), 'context/BUILD_SPECIFICATION.md'),
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        this.buildSpecCache = fs.readFileSync(p, 'utf-8');
        this.parseBuildSpecSections(this.buildSpecCache);
        return;
      }
    }
    this.buildSpecCache = '';
  }

  private static getBuildSpecSection(keyword: string): string | null {
    const key = keyword.toLowerCase();
    for (const [heading, content] of this.buildSpecSections.entries()) {
      if (heading.toLowerCase().includes(key)) {
        return content;
      }
    }
    return null;
  }

  private static parseBuildSpecSections(content: string): void {
    const lines = content.split('\n');
    let currentHeading = '';
    let currentContent: string[] = [];

    for (const line of lines) {
      if (line.startsWith('# ') || line.startsWith('## ')) {
        if (currentHeading) {
          this.buildSpecSections.set(currentHeading, [currentHeading, ...currentContent].join('\n').trim());
        }
        currentHeading = line.replace(/^#+\s*/, '');
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    if (currentHeading) {
      this.buildSpecSections.set(currentHeading, [currentHeading, ...currentContent].join('\n').trim());
    }
  }
}
