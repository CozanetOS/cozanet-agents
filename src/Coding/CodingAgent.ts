// ── CodingAgent — Real LLM-powered code engineering ──────────────────
//
// v0.3.0 — All methods now use ModelAdapter for real LLM calls.
// No more hardcoded "Hello CozanetOS!" or score: 85 stubs.
//
// Supports: code generation, review, refactoring, explanation, test generation.
// Uses domain context from ContextManager for project-aware suggestions.

import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';
import { ContextManager } from '../context/ContextManager';
import { ModelAdapter } from '../models/ModelAdapter';

export interface CodeReview {
  approved: boolean;
  issues: Array<{ severity: 'critical' | 'high' | 'medium' | 'low'; line?: number; description: string; suggestion?: string }>;
  suggestions: string[];
  score: number;
  metrics: { readability: number; maintainability: number; security: number; performance: number };
  summary: string;
}

export interface CodeGenerationResult {
  code: string;
  language: string;
  files: { path: string; content: string }[];
  description: string;
  warnings?: string[];
}

export interface RefactorResult {
  code: string;
  changes: string[];
  summary: string;
}

export interface TestGenerationResult {
  tests: string;
  framework: string;
  coverage: string;
  testCases: string[];
}

/**
 * CodingAgent — software engineering: code generation, review, refactoring.
 * Uses ModelAdapter for real LLM-powered code intelligence.
 */
export class CodingAgent extends BaseAgent {
  private model: ModelAdapter;

  constructor() {
    super('agent:coding', 'Coding Agent', 'Software Engineering & Review');
    this.model = ModelAdapter.getInstance();

    this.registerCapability({
      name: 'coding',
      description: 'Generate, review, refactor, explain, and test code',
      taskTypes: ['generate_code', 'review_code', 'refactor', 'explain_code', 'generate_tests'],
    });
  }

  protected onStart(): void {
    console.log(`[${this.id}] Coding Agent online — LLM-powered code engineering ready.`);
  }

  public async handle(task: AgentTask): Promise<any> {
    switch (task.type) {
      case 'generate_code':
        return this.generateCode(task.input.spec, task.input.language, task.input.context);
      case 'review_code':
        return this.reviewCode(task.input.code, task.input.language);
      case 'refactor':
        return this.refactor(task.input.code, task.input.goal);
      case 'explain_code':
        return this.explainCode(task.input.code);
      case 'generate_tests':
        return this.generateTests(task.input.code, task.input.framework, task.input.language);
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  // ── Code Generation ──────────────────────────────────────────────────

  public async generateCode(
    spec: string,
    language: string,
    context?: string,
  ): Promise<CodeGenerationResult> {
    console.log(`[${this.id}] Generating ${language} code for: ${spec.slice(0, 80)}`);

    const domainContext = this.getContext();

    const systemPrompt = `You are a senior ${language} engineer. Generate production-quality code based on the specification.
Rules:
- Write clean, well-structured, idiomatic ${language}
- Include error handling where appropriate
- Add brief inline comments for non-obvious logic
- If multiple files make sense, separate them with "// FILE: path/to/file.ext" markers
- Return ONLY code, no explanations before or after
${context ? `- Project context: ${context}` : ''}
${domainContext ? `- Domain context: ${domainContext.slice(0, 2000)}` : ''}`;

    const result = await this.model.generate(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate ${language} code for:\n\n${spec}` },
      ],
      { maxTokens: 4096, temperature: 0.2 },
    );

    // Parse multi-file output if present
    const files = this.parseMultiFile(result.text, language);

    return {
      code: result.text,
      language,
      files: files.length > 0 ? files : [{ path: 'main.' + this.getFileExt(language), content: result.text }],
      description: `Generated ${language} implementation for: ${spec.slice(0, 100)}`,
      warnings: result.finishReason === 'length' ? ['Output was truncated — may be incomplete'] : undefined,
    };
  }

  // ── Code Review ──────────────────────────────────────────────────────

  public async reviewCode(code: string, language?: string): Promise<CodeReview> {
    console.log(`[${this.id}] Reviewing ${code.length} chars of code...`);

    const systemPrompt = `You are a senior code reviewer. Analyze the code and return a JSON object with this exact structure:
{
  "approved": boolean,
  "issues": [{ "severity": "critical|high|medium|low", "line": number, "description": "what's wrong", "suggestion": "how to fix" }],
  "suggestions": ["improvement idea 1", "improvement idea 2"],
  "score": number (0-100),
  "metrics": { "readability": number (1-10), "maintainability": number (1-10), "security": number (1-10), "performance": number (1-10) },
  "summary": "one paragraph overall assessment"
}

Be thorough but fair. Flag real issues only — no false positives. Security issues are always at least "high".
Return ONLY the JSON, no markdown fences.`;

    const result = await this.model.generate(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${language ? `Language: ${language}\n` : ''}Code:\n\n\`\`\`\n${code}\n\`\`\`` },
      ],
      { maxTokens: 2048, temperature: 0.3, responseFormat: 'json' },
    );

    try {
      const review = this.parseJSON<CodeReview>(result.text, {
        approved: false,
        issues: [],
        suggestions: [],
        score: 0,
        metrics: { readability: 0, maintainability: 0, security: 0, performance: 0 },
        summary: 'Review failed — could not parse LLM output.',
      });

      // Validate score range
      review.score = Math.max(0, Math.min(100, review.score));
      for (const key of ['readability', 'maintainability', 'security', 'performance'] as const) {
        review.metrics[key] = Math.max(0, Math.min(10, review.metrics[key]));
      }

      return review;
    } catch {
      return {
        approved: false,
        issues: [{ severity: 'medium', description: 'Code review could not be parsed from LLM output' }],
        suggestions: [],
        score: 0,
        metrics: { readability: 0, maintainability: 0, security: 0, performance: 0 },
        summary: result.text.slice(0, 500),
      };
    }
  }

  // ── Refactoring ──────────────────────────────────────────────────────

  public async refactor(code: string, goal: string): Promise<RefactorResult> {
    console.log(`[${this.id}] Refactoring toward: ${goal.slice(0, 80)}`);

    const systemPrompt = `You are a refactoring specialist. Refactor the given code toward the stated goal.
Rules:
- Preserve behavior — the refactored code must do the same thing
- Return ONLY the refactored code, no explanations
- After the code, add a line starting with "// CHANGES:" followed by a comma-separated list of changes made`;

    const result = await this.model.generate(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Goal: ${goal}\n\nCode:\n\n\`\`\`\n${code}\n\`\`\`` },
      ],
      { maxTokens: 4096, temperature: 0.2 },
    );

    // Split code from changes list
    const changesMatch = result.text.match(/\/\/ CHANGES:\s*(.+)/i);
    const codePart = changesMatch
      ? result.text.slice(0, changesMatch.index).trim()
      : result.text.trim();
    const changes = changesMatch
      ? changesMatch[1].split(',').map(c => c.trim()).filter(Boolean)
      : ['Refactored code (no detailed change list provided)'];

    return {
      code: codePart,
      changes,
      summary: `Refactored toward: ${goal}. ${changes.length} changes made.`,
    };
  }

  // ── Code Explanation ─────────────────────────────────────────────────

  public async explainCode(code: string): Promise<string> {
    console.log(`[${this.id}] Explaining code (${code.length} chars)...`);

    const systemPrompt = `You are a code educator. Explain code clearly and concisely.
Structure:
1. One-sentence summary of what the code does
2. Step-by-step walkthrough of key logic
3. Any patterns or anti-patterns used
4. Potential issues or edge cases

Be precise. No filler. If the code is simple, keep the explanation short.`;

    const result = await this.model.generate(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Explain this code:\n\n\`\`\`\n${code}\n\`\`\`` },
      ],
      { maxTokens: 2048, temperature: 0.3 },
    );

    return result.text;
  }

  // ── Test Generation ──────────────────────────────────────────────────

  public async generateTests(
    code: string,
    framework = 'jest',
    language?: string,
  ): Promise<TestGenerationResult> {
    console.log(`[${this.id}] Generating ${framework} tests...`);

    const systemPrompt = `You are a test engineer. Generate comprehensive ${framework} tests for the given code.
Rules:
- Cover happy paths, edge cases, and error scenarios
- Use descriptive test names (describe/it blocks)
- Mock external dependencies
- Return ONLY the test code, no explanations
- At the end, add "// TEST_CASES:" followed by a comma-separated list of test case names`;

    const result = await this.model.generate(
      [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `${language ? `Language: ${language}\n` : ''}Framework: ${framework}\n\nCode to test:\n\n\`\`\`\n${code}\n\`\`\``,
        },
      ],
      { maxTokens: 4096, temperature: 0.3 },
    );

    // Extract test case list
    const tcMatch = result.text.match(/\/\/ TEST_CASES:\s*(.+)/i);
    const testCode = tcMatch ? result.text.slice(0, tcMatch.index).trim() : result.text.trim();
    const testCases = tcMatch
      ? tcMatch[1].split(',').map(t => t.trim()).filter(Boolean)
      : [];

    // Estimate coverage based on test case count vs code complexity
    const linesOfCode = code.split('\n').filter(l => l.trim() && !l.trim().startsWith('//')).length;
    const coverageEstimate = Math.min(95, Math.round((testCases.length / Math.max(1, linesOfCode / 5)) * 100));

    return {
      tests: testCode,
      framework,
      coverage: `${coverageEstimate}% (estimated)`,
      testCases,
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  private parseMultiFile(text: string, language: string): { path: string; content: string }[] {
    // Split on "// FILE: path" or "# FILE: path" markers
    const fileMarker = /(?:\/\/|#|<!--)\s*FILE:\s*(.+)/i;
    const parts = text.split(fileMarker);

    if (parts.length <= 1) return []; // No multi-file markers

    const files: { path: string; content: string }[] = [];
    for (let i = 1; i < parts.length; i += 2) {
      const path = parts[i].trim();
      const content = (parts[i + 1] || '').trim();
      if (path && content) files.push({ path, content });
    }
    return files;
  }

  private parseJSON<T>(text: string, fallback: T): T {
    // Strip markdown fences if present
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    return JSON.parse(cleaned) as T;
  }

  private getFileExt(language: string): string {
    const exts: Record<string, string> = {
      typescript: 'ts', ts: 'ts', javascript: 'js', js: 'js',
      python: 'py', rust: 'rs', go: 'go', java: 'java',
      csharp: 'cs', cpp: 'cpp', c: 'c', ruby: 'rb',
      php: 'php', swift: 'swift', kotlin: 'kt', solidity: 'sol',
    };
    return exts[language.toLowerCase()] || 'txt';
  }

  // ── Domain Context ───────────────────────────────────────────────────
  private context: string | null = null;

  public getContext(): string {
    if (!this.context) {
      this.context = ContextManager.loadDomainContext('Engineering');
    }
    return this.context;
  }

  public refreshContext(): void {
    this.context = null;
  }
}
