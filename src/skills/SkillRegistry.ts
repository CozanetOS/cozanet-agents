import { SkillDefinition, SkillExecution } from './types';

/**
 * SkillRegistry — skill registration and execution for CozanetOS.
 *
 * Per build spec Section 32: skills are modes the orchestrator can switch
 * between, rather than a complicated swarm of separate agents.
 *
 * Pre-registers the 7 initial skills: Architect, Engineer, Researcher,
 * QA, Security, Company Intelligence, Funding Analyst.
 */
export class SkillRegistry {
  private static instance: SkillRegistry | null = null;
  private skills: Map<string, SkillDefinition> = new Map();
  private executions: SkillExecution[] = [];

  private constructor() {
    this.registerInitialSkills();
  }

  static getInstance(): SkillRegistry {
    if (!SkillRegistry.instance) {
      SkillRegistry.instance = new SkillRegistry();
    }
    return SkillRegistry.instance;
  }

  // ── Registration ────────────────────────────────────────────────────
  registerSkill(skill: SkillDefinition): void {
    this.skills.set(skill.id, skill);
    console.log(`[SkillRegistry] Registered skill: ${skill.name} (${skill.id})`);
  }

  unregisterSkill(skillId: string): boolean {
    return this.skills.delete(skillId);
  }

  // ── Retrieval ──────────────────────────────────────────────────────
  getSkill(skillId: string): SkillDefinition | null {
    return this.skills.get(skillId) ?? null;
  }

  listSkills(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  listSkillsForDomain(domain: string): SkillDefinition[] {
    return this.listSkills().filter(s => s.domain === domain);
  }

  getSystemPrompt(skillId: string): string | null {
    return this.skills.get(skillId)?.systemPrompt ?? null;
  }

  // ── Discovery ──────────────────────────────────────────────────────
  discoverSkills(keyword: string): SkillDefinition[] {
    const lower = keyword.toLowerCase();
    return this.listSkills().filter(s =>
      s.name.toLowerCase().includes(lower) ||
      s.description.toLowerCase().includes(lower) ||
      s.capabilities.some(c => c.toLowerCase().includes(lower))
    );
  }

  // ── Execution ─────────────────────────────────────────────────────
  async executeSkill(skillId: string, agentId: string, input: any): Promise<SkillExecution> {
    const skill = this.skills.get(skillId);
    const start = Date.now();

    const execution: SkillExecution = {
      skillId,
      agentId,
      input,
      status: 'pending',
      startedAt: start,
    };

    if (!skill) {
      execution.status = 'failed';
      execution.error = `Skill "${skillId}" not found`;
      execution.completedAt = Date.now();
      this.executions.push(execution);
      return execution;
    }

    execution.status = 'running';
    console.log(`[SkillRegistry] Executing skill "${skill.name}" for agent ${agentId}`);

    // The skill execution would dispatch to the agent with the skill's
    // system prompt and tools. Here we return the skill metadata + input
    // for the orchestrator to use.
    execution.output = {
      skillName: skill.name,
      systemPrompt: skill.systemPrompt,
      capabilities: skill.capabilities,
      tools: skill.tools,
      input,
    };
    execution.status = 'done';
    execution.completedAt = Date.now();

    this.executions.push(execution);
    return execution;
  }

  getExecutions(): SkillExecution[] {
    return [...this.executions];
  }

  // ── Pre-registered skills (build spec Section 32) ───────────────────
  private registerInitialSkills(): void {
    this.registerSkill({
      id: 'skill:architect',
      name: 'Architect',
      description: 'Protect architecture and evaluate system changes against AEGIS constitution.',
      systemPrompt: 'You are the Architect. Evaluate all proposed changes against the AEGIS architecture constitution. Flag conflicts with: non-custodial principle, smart routing, Vault Engine preference, architecture-as-source-of-truth, user control. Reject changes that cross engine boundaries or duplicate logic. Architecture supersedes implementation when they conflict.',
      capabilities: ['architecture review', 'constitution check', 'boundary enforcement', 'conflict detection'],
      permissionLevel: 'prepare',
      tools: [],
      domain: 'AEGIS',
    });

    this.registerSkill({
      id: 'skill:engineer',
      name: 'Engineer',
      description: 'Implement code — write, refactor, and build features.',
      systemPrompt: 'You are the Engineer. Implement code following GitHub-first development. Write clean TypeScript with strict mode. Respect existing architecture boundaries. Never hardcode secrets. Test what you build. Commit with proper messages.',
      capabilities: ['code implementation', 'refactoring', 'build', 'debug', 'type checking'],
      permissionLevel: 'prepare',
      tools: [],
      domain: 'Engineering',
    });

    this.registerSkill({
      id: 'skill:researcher',
      name: 'Researcher',
      description: 'Search and verify information from multiple sources.',
      systemPrompt: 'You are the Researcher. Search broadly, verify sources, cross-reference claims. Never fabricate. Distinguish facts from assumptions from opinions. Cite sources. Flag stale information. Apply anti-repetition: check if a similar search was done before.',
      capabilities: ['web search', 'source verification', 'fact checking', 'cross-referencing', 'summarization'],
      permissionLevel: 'autonomous',
      tools: [],
      domain: 'Research',
    });

    this.registerSkill({
      id: 'skill:qa',
      name: 'QA',
      description: 'Test and attempt to break implementations.',
      systemPrompt: 'You are QA. Test everything. Try to break it. Check edge cases, error states, boundary conditions. Verify builds compile. Run existing tests. Never say something works without testing it. Never confuse intention with successful execution.',
      capabilities: ['testing', 'edge case discovery', 'regression testing', 'build verification', 'error simulation'],
      permissionLevel: 'autonomous',
      tools: [],
      domain: 'Engineering',
    });

    this.registerSkill({
      id: 'skill:security',
      name: 'Security',
      description: 'Find security weaknesses in code and infrastructure.',
      systemPrompt: 'You are Security. Scan for: exposed secrets, client-side private keys, insecure wallet derivation, privileged DB access, missing env separation, excessive permissions, unsafe deployment assumptions. Security is architecture, not an afterthought. Flag issues proactively.',
      capabilities: ['secret detection', 'vulnerability scanning', 'wallet security audit', 'permission audit', 'deployment security'],
      permissionLevel: 'autonomous',
      tools: [],
      domain: 'Security',
    });

    this.registerSkill({
      id: 'skill:company-intel',
      name: 'Company Intelligence',
      description: 'Monitor Cozanet ecosystem, competitors, and market.',
      systemPrompt: 'You are Company Intelligence. Monitor the Cozanet ecosystem, track competitors, market trends, regulatory changes, and technology shifts. Maintain strategic awareness. Report opportunities and threats. Think in systems — connect dots across domains.',
      capabilities: ['competitor analysis', 'market monitoring', 'regulatory tracking', 'ecosystem mapping', 'strategic intelligence'],
      permissionLevel: 'autonomous',
      tools: [],
      domain: 'Strategic Intelligence',
    });

    this.registerSkill({
      id: 'skill:funding-analyst',
      name: 'Funding Analyst',
      description: 'Find and rank funding opportunities — grants, hackathons, accelerators.',
      systemPrompt: 'You are the Funding Analyst. Find grants, hackathons, incubators, accelerators relevant to Cozanet. Rank by: eligibility, deadline, effort vs reward, strategic fit, African market focus. Never assume access to large capital. Prefer low-cost paths, free tiers, open-source.',
      capabilities: ['grant discovery', 'opportunity ranking', 'deadline tracking', 'eligibility checking', 'funding strategy'],
      permissionLevel: 'autonomous',
      tools: [],
      domain: 'Funding',
    });
  }
}
