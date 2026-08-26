// ── TestingAgent — Real test execution + LLM test generation ─────────
//
// v0.3.0 — All methods now use real implementations:
//  - runTests(): Actually executes test commands via child_process
//    (jest, vitest, mocha, pytest) and parses real output
//  - generateTests(): Real LLM-powered test generation with proper
//    test cases, edge cases, and mocking strategies
//  - analyzeCoverage(): Real coverage analysis via test runner output
//  - runE2E(): Real E2E test execution (playwright/cypress)
//  - benchmark(): Real performance benchmarking using actual execution

import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';
import { ContextManager } from '../context/ContextManager';
import { ModelAdapter } from '../models/ModelAdapter';
import { exec } from 'child_process';
import * as path from 'path';

export interface TestResult {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  coverage: number;
  failures: Array<{
    name: string;
    error: string;
    expected?: string;
    actual?: string;
  }>;
  rawOutput: string;
  framework: string;
}

export interface GeneratedTests {
  tests: string;
  framework: string;
  count: number;
  testCases: Array<{
    name: string;
    description: string;
    type: 'unit' | 'integration' | 'edge_case' | 'error_case';
  }>;
}

export interface CoverageResult {
  coverage: number;
  uncovered: string[];
  branches: number;
  functions: number;
  lines: number;
  statements: number;
}

export interface BenchmarkResult {
  avgMs: number;
  minMs: number;
  maxMs: number;
  iterations: number;
  totalMs: number;
  opsPerSecond: number;
  rawResults: number[];
}

/**
 * TestingAgent — test execution, coverage analysis, and test generation.
 * Runs real test commands and uses LLM for test generation.
 */
export class TestingAgent extends BaseAgent {
  private model: ModelAdapter;

  constructor() {
    super('agent:testing', 'Testing Agent', 'Test Execution & Quality Assurance');
    this.model = ModelAdapter.getInstance();

    this.registerCapability({
      name: 'testing',
      description: 'Run tests, analyze coverage, generate test cases, and report results',
      taskTypes: ['run_tests', 'generate_tests', 'analyze_coverage', 'e2e_test', 'benchmark'],
    });
  }

  protected onStart(): void {
    console.log(`[${this.id}] Testing Agent online — real test execution + LLM generation.`);
  }

  public async handle(task: AgentTask): Promise<any> {
    switch (task.type) {
      case 'run_tests':
        return this.runTests(task.input.path, task.input.framework, task.input.timeout);
      case 'generate_tests':
        return this.generateTests(task.input.code, task.input.framework, task.input.language);
      case 'analyze_coverage':
        return this.analyzeCoverage(task.input.path, task.input.framework);
      case 'e2e_test':
        return this.runE2E(task.input.scenario, task.input.config, task.input.timeout);
      case 'benchmark':
        return this.benchmark(task.input.code, task.input.iterations, task.input.language);
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  // ── Run Tests (Real execution via child_process) ────────────────────

  public async runTests(testPath: string, framework: string = 'auto', timeout: number = 60000): Promise<TestResult> {
    console.log(`[${this.id}] Running ${framework} tests at ${testPath}`);

    // Detect framework if auto
    const actualFramework = framework === 'auto' ? this.detectFramework(testPath) : framework;

    // Build the test command
    const command = this.buildTestCommand(actualFramework, testPath);

    console.log(`[${this.id}] Executing: ${command}`);

    try {
      const output = await this.execCommand(command, timeout);
      return this.parseTestOutput(output.stdout, output.stderr, actualFramework, output.durationMs);
    } catch (err: any) {
      // Test runner exits non-zero on test failures — check stderr/stdout for results
      const output = err.stdout || err.stderr || err.message;
      return this.parseTestOutput(output, err.stderr || '', actualFramework, err.durationMs || 0);
    }
  }

  // ── Generate Tests (Real LLM) ──────────────────────────────────────

  public async generateTests(
    code: string,
    framework: string = 'jest',
    language: string = 'typescript',
  ): Promise<GeneratedTests> {
    console.log(`[${this.id}] Generating ${framework} tests for ${language} code (${code.length} chars)`);

    const systemPrompt = `You are a test engineer. Generate comprehensive ${framework} tests for the given ${language} code.

Requirements:
- Test all public functions/methods
- Include edge cases (empty input, null, boundary values, invalid types)
- Include error cases (expected throws, rejected promises)
- Use proper mocking for external dependencies
- Follow ${framework} best practices and conventions
- Each test should be independent and deterministic

Return a JSON object:
{
  "tests": "the complete test file content as a string",
  "count": <number of test cases>,
  "testCases": [
    {
      "name": "test name",
      "description": "what it tests",
      "type": "unit" | "integration" | "edge_case" | "error_case"
    }
  ]
}

Return ONLY the JSON. The "tests" field should contain valid, runnable test code.`;

    try {
      const result = await this.model.generate(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: code.slice(0, 8000) },
        ],
        { maxTokens: 4096, temperature: 0.2, responseFormat: 'json' },
      );

      const parsed = this.parseJSON<any>(result.text, null);

      if (parsed && parsed.tests) {
        return {
          tests: parsed.tests,
          framework,
          count: parsed.count || this.countTests(parsed.tests, framework),
          testCases: Array.isArray(parsed.testCases) ? parsed.testCases : [],
        };
      }

      // If JSON parsing fails, the raw text might still be usable test code
      if (result.text.includes('describe') || result.text.includes('test(') || result.text.includes('def test')) {
        return {
          tests: this.stripMarkdown(result.text),
          framework,
          count: this.countTests(result.text, framework),
          testCases: [],
        };
      }

      return {
        tests: `// Test generation failed — LLM output could not be parsed`,
        framework,
        count: 0,
        testCases: [],
      };
    } catch (err: any) {
      return {
        tests: `// Test generation failed: ${err.message}`,
        framework,
        count: 0,
        testCases: [],
      };
    }
  }

  // ── Analyze Coverage (Real) ─────────────────────────────────────────

  public async analyzeCoverage(testPath: string, framework: string = 'auto'): Promise<CoverageResult> {
    console.log(`[${this.id}] Analyzing coverage at ${testPath}`);

    const actualFramework = framework === 'auto' ? this.detectFramework(testPath) : framework;

    // Build coverage command
    const command = this.buildCoverageCommand(actualFramework, testPath);

    try {
      const output = await this.execCommand(command, 60000);
      return this.parseCoverageOutput(output.stdout, actualFramework);
    } catch (err: any) {
      const output = err.stdout || err.stderr || '';
      if (output) {
        return this.parseCoverageOutput(output, actualFramework);
      }
      return {
        coverage: 0,
        uncovered: [],
        branches: 0,
        functions: 0,
        lines: 0,
        statements: 0,
      };
    }
  }

  // ── E2E Test (Real execution) ───────────────────────────────────────

  public async runE2E(scenario: string, config?: any, timeout: number = 120000): Promise<TestResult> {
    console.log(`[${this.id}] E2E test: ${scenario}`);

    // If config has a command, run it directly
    if (config?.command) {
      try {
        const output = await this.execCommand(config.command, timeout);
        return this.parseTestOutput(output.stdout, output.stderr, 'e2e', output.durationMs);
      } catch (err: any) {
        const output = err.stdout || err.stderr || err.message;
        return this.parseTestOutput(output, err.stderr || '', 'e2e', err.durationMs || 0);
      }
    }

    // If config has a test file, try running it with the appropriate runner
    if (config?.file) {
      const ext = path.extname(config.file).toLowerCase();
      let command: string;

      if (ext === '.ts' || ext === '.js') {
        command = `npx playwright test ${config.file}`;
      } else if (ext === '.py') {
        command = `python -m pytest ${config.file}`;
      } else {
        command = `node ${config.file}`;
      }

      try {
        const output = await this.execCommand(command, timeout);
        return this.parseTestOutput(output.stdout, output.stderr, 'e2e', output.durationMs);
      } catch (err: any) {
        const output = err.stdout || err.stderr || err.message;
        return this.parseTestOutput(output, err.stderr || '', 'e2e', err.durationMs || 0);
      }
    }

    // No command or file provided — return empty result
    return {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      coverage: 0,
      failures: [],
      rawOutput: 'No E2E test command or file provided',
      framework: 'e2e',
    };
  }

  // ── Benchmark (Real execution) ──────────────────────────────────────

  public async benchmark(code: string, iterations: number = 1000, language: string = 'javascript'): Promise<BenchmarkResult> {
    console.log(`[${this.id}] Benchmarking ${iterations} iterations (${language})`);

    // Wrap the code in a benchmark harness
    let benchCode: string;

    if (language === 'typescript' || language === 'javascript') {
      benchCode = `
const results = [];
${code}
for (let i = 0; i < ${iterations}; i++) {
  const start = process.hrtime.bigint();
  // Call the function (assume it's named 'fn' or has a default export)
  try { fn(); } catch(e) { try { module.exports(); } catch(e2) {} }
  const end = process.hrtime.bigint();
  results.push(Number(end - start) / 1e6); // convert to ms
}
const total = results.reduce((a, b) => a + b, 0);
const avg = total / results.length;
const min = Math.min(...results);
const max = Math.max(...results);
const opsPerSec = Math.round(1000 / avg);
console.log(JSON.stringify({ avgMs: avg, minMs: min, maxMs: max, iterations: ${iterations}, totalMs: total, opsPerSecond: opsPerSec, rawResults: results.slice(0, 100) }));
`;
    } else {
      return {
        avgMs: 0,
        minMs: 0,
        maxMs: 0,
        iterations: 0,
        totalMs: 0,
        opsPerSecond: 0,
        rawResults: [],
      };
    }

    try {
      const output = await this.execCommand(`node -e "${benchCode.replace(/"/g, '\\"')}"`, 30000);
      const parsed = this.parseJSON<any>(output.stdout, null);

      if (parsed) {
        return {
          avgMs: parsed.avgMs || 0,
          minMs: parsed.minMs || 0,
          maxMs: parsed.maxMs || 0,
          iterations: parsed.iterations || iterations,
          totalMs: parsed.totalMs || 0,
          opsPerSecond: parsed.opsPerSecond || 0,
          rawResults: Array.isArray(parsed.rawResults) ? parsed.rawResults : [],
        };
      }

      return {
        avgMs: 0,
        minMs: 0,
        maxMs: 0,
        iterations,
        totalMs: 0,
        opsPerSecond: 0,
        rawResults: [],
      };
    } catch {
      return {
        avgMs: 0,
        minMs: 0,
        maxMs: 0,
        iterations,
        totalMs: 0,
        opsPerSecond: 0,
        rawResults: [],
      };
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private detectFramework(testPath: string): string {
    const lower = testPath.toLowerCase();
    if (lower.includes('vitest') || lower.includes('.vitest.')) return 'vitest';
    if (lower.includes('pytest') || lower.includes('test_') || lower.includes('_test.py')) return 'pytest';
    if (lower.includes('mocha')) return 'mocha';
    // Default: check package.json for jest
    try {
      const pkg = require(path.join(process.cwd(), 'package.json'));
      if (pkg.devDependencies?.vitest) return 'vitest';
      if (pkg.devDependencies?.jest) return 'jest';
      if (pkg.devDependencies?.mocha) return 'mocha';
    } catch { /* ignore */ }
    return 'jest';
  }

  private buildTestCommand(framework: string, testPath: string): string {
    switch (framework) {
      case 'vitest':
        return `npx vitest run ${testPath} --reporter=verbose 2>&1`;
      case 'mocha':
        return `npx mocha ${testPath} --reporter spec 2>&1`;
      case 'pytest':
        return `python -m pytest ${testPath} -v 2>&1`;
      case 'jest':
      default:
        return `npx jest ${testPath} --verbose 2>&1`;
    }
  }

  private buildCoverageCommand(framework: string, testPath: string): string {
    switch (framework) {
      case 'vitest':
        return `npx vitest run ${testPath} --coverage 2>&1`;
      case 'pytest':
        return `python -m pytest ${testPath} --cov 2>&1`;
      case 'jest':
      default:
        return `npx jest ${testPath} --coverage 2>&1`;
    }
  }

  private parseTestOutput(stdout: string, stderr: string, framework: string, durationMs: number): TestResult {
    const output = stdout + stderr;
    const failures: TestResult['failures'] = [];

    // Framework-specific parsing
    if (framework === 'jest' || framework === 'vitest') {
      // Jest/Vitest output: "Tests: X passed, Y failed, Z skipped"
      const testMatch = output.match(/Tests:\s+(\d+)\s+(?:passed|failed|skipped)/g) || [];
      let passed = 0, failed = 0, skipped = 0, total = 0;

      for (const m of testMatch) {
        const num = parseInt(m.match(/\d+/)?.[0] || '0');
        if (m.includes('passed')) passed = num;
        else if (m.includes('failed')) failed = num;
        else if (m.includes('skipped') || m.includes('todo')) skipped = num;
      }

      // Alternative: "✓ X" / "✕ Y" / "○ Z" format
      if (total === 0) {
        const passedMatches = output.match(/✓|✗|√|×/g) || [];
        total = passedMatches.length;
        passed = (output.match(/✓|√/g) || []).length;
        failed = (output.match(/✗|×/g) || []).length;
        if (total === 0) total = passed + failed;
      }

      // Extract failure details
      const failBlocks = output.split(/●|FAIL/).slice(1);
      for (const block of failBlocks) {
        const lines = block.trim().split('\n').filter(l => l.trim());
        if (lines.length > 0) {
          const name = lines[0].trim().slice(0, 200);
          const errorLine = lines.find(l => l.includes('Expected') || l.includes('Error') || l.includes('expect'));
          const expected = lines.find(l => l.includes('Expected'))?.trim();
          const actual = lines.find(l => l.includes('Received'))?.trim();
          failures.push({
            name,
            error: errorLine || block.trim().slice(0, 500),
            expected: expected?.replace(/^Expected:\s*/, ''),
            actual: actual?.replace(/^Received:\s*/, ''),
          });
        }
      }

      // Coverage
      const coverageMatch = output.match(/All files\s*\|?\s*([\d.]+)%/);
      const coverage = coverageMatch ? parseFloat(coverageMatch[1]) : 0;

      return {
        total: total || passed + failed + skipped,
        passed,
        failed,
        skipped,
        duration: durationMs,
        coverage,
        failures,
        rawOutput: output.slice(0, 5000),
        framework,
      };
    }

    if (framework === 'pytest') {
      // "X passed, Y failed in Zs"
      const passedMatch = output.match(/(\d+)\s+passed/);
      const failedMatch = output.match(/(\d+)\s+failed/);
      const skippedMatch = output.match(/(\d+)\s+skipped/);

      const passed = passedMatch ? parseInt(passedMatch[1]) : 0;
      const failed = failedMatch ? parseInt(failedMatch[1]) : 0;
      const skipped = skippedMatch ? parseInt(skippedMatch[1]) : 0;

      // Extract failure details (FAILED in pytest output)
      const failLines = output.split('\n').filter(l => l.includes('FAILED'));
      for (const line of failLines) {
        failures.push({
          name: line.replace(/^FAILED\s+/, '').trim(),
          error: 'Test failed',
        });
      }

      return {
        total: passed + failed + skipped,
        passed,
        failed,
        skipped,
        duration: durationMs,
        coverage: 0,
        failures,
        rawOutput: output.slice(0, 5000),
        framework,
      };
    }

    // Generic fallback
    const allLines = output.split('\n');
    const passed = (output.match(/✓|PASS|passed/gi) || []).length;
    const failed = (output.match(/✗|FAIL|failed/gi) || []).length;
    return {
      total: passed + failed,
      passed,
      failed,
      skipped: 0,
      duration: durationMs,
      coverage: 0,
      failures,
      rawOutput: output.slice(0, 5000),
      framework,
    };
  }

  private parseCoverageOutput(stdout: string, framework: string): CoverageResult {
    // Jest/Vitest coverage table: "All files | 85.5 | 80 | 90 | 82"
    const match = stdout.match(/All files\s*\|?\s*([\d.]+)\s*\|?\s*([\d.]+)?\s*\|?\s*([\d.]+)?\s*\|?\s*([\d.]+)?/);

    if (match) {
      return {
        coverage: parseFloat(match[1]) || 0,
        uncovered: [],
        branches: parseFloat(match[2]) || 0,
        functions: parseFloat(match[3]) || 0,
        lines: parseFloat(match[1]) || 0,
        statements: parseFloat(match[4]) || parseFloat(match[1]) || 0,
      };
    }

    // Try percentage format
    const pctMatch = stdout.match(/Coverage:\s*([\d.]+)%/);
    if (pctMatch) {
      return {
        coverage: parseFloat(pctMatch[1]),
        uncovered: [],
        branches: 0,
        functions: 0,
        lines: 0,
        statements: 0,
      };
    }

    return {
      coverage: 0,
      uncovered: [],
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    };
  }

  private countTests(code: string, framework: string): number {
    if (framework === 'pytest') {
      return (code.match(/\bdef test_/g) || []).length;
    }
    // Jest/Vitest/Mocha: count it() and test() calls
    return (code.match(/\b(?:it|test)\s*\(/g) || []).length;
  }

  private execCommand(command: string, timeout: number): Promise<{ stdout: string; stderr: string; durationMs: number }> {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      exec(command, {
        cwd: process.cwd(),
        timeout,
        maxBuffer: 1024 * 1024 * 5, // 5MB
      }, (err, stdout, stderr) => {
        const durationMs = Date.now() - start;
        if (err && !stdout) {
          (err as any).stdout = '';
          (err as any).stderr = stderr;
          (err as any).durationMs = durationMs;
          reject(err);
        } else {
          resolve({ stdout: stdout || '', stderr: stderr || '', durationMs });
        }
      });
    });
  }

  private parseJSON<T>(text: string, fallback: T): T {
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      return fallback;
    }
  }

  private stripMarkdown(text: string): string {
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:javascript|typescript|js|ts|python)?\n?/, '').replace(/\n?```$/, '');
    }
    return cleaned;
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
