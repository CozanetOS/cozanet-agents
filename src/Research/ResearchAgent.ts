// ── ResearchAgent — Real LLM-powered research ───────────────────────
//
// v0.3.0 — All methods now use ModelAdapter for real LLM calls:
//  - research(): Real LLM synthesis with structured output, sources,
//    confidence, key findings, related topics
//  - summarize(): Real LLM summarization (was content.slice() truncation)
//  - factCheck(): Real LLM claim analysis with verdict + reasoning
//  - compare(): New — compare multiple options/topics side by side
//  - deepDive(): New — iterative research that drills deeper into subtopics

import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';
import { ContextManager } from '../context/ContextManager';
import { ModelAdapter } from '../models/ModelAdapter';

export interface ResearchResult {
  topic: string;
  summary: string;
  keyFindings: string[];
  sources: string[];
  confidence: number;
  relatedTopics: string[];
  followUpQuestions: string[];
  researchedAt: number;
}

export interface FactCheckResult {
  claim: string;
  verdict: 'true' | 'mostly_true' | 'mixed' | 'mostly_false' | 'false' | 'unverifiable';
  confidence: number;
  reasoning: string;
  evidence: string[];
  sources: string[];
  checkedAt: number;
}

export interface CompareResult {
  options: Array<{
    name: string;
    pros: string[];
    cons: string[];
    score: number;
    notes: string;
  }>;
  recommendation: string;
  recommendationReason: string;
  comparedAt: number;
}

export interface SummarizeResult {
  summary: string;
  keyPoints: string[];
  wordCount: number;
  compressionRatio: number;
}

/**
 * ResearchAgent — gathers, synthesizes, and summarizes information.
 * Uses LLM for real research, not hardcoded placeholders.
 */
export class ResearchAgent extends BaseAgent {
  private model: ModelAdapter;

  constructor() {
    super('agent:research', 'Research Agent', 'Information Gathering & Synthesis');
    this.model = ModelAdapter.getInstance();

    this.registerCapability({
      name: 'research',
      description: 'Research topics, synthesize information, fact-check claims, and compare options',
      taskTypes: ['research', 'summarize', 'fact_check', 'compare', 'deep_dive'],
    });
  }

  protected onStart(): void {
    console.log(`[${this.id}] Research Agent online — LLM-powered investigation ready.`);
  }

  public async handle(task: AgentTask): Promise<any> {
    switch (task.type) {
      case 'research':
        return this.research(task.input.topic, task.input.depth);
      case 'summarize':
        return this.summarize(task.input.content, task.input.maxWords, task.input.format);
      case 'fact_check':
        return this.factCheck(task.input.claim, task.input.context);
      case 'compare':
        return this.compare(task.input.options, task.input.criteria);
      case 'deep_dive':
        return this.deepDive(task.input.topic, task.input.subtopics);
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  // ── Research (Real LLM synthesis) ───────────────────────────────────

  public async research(topic: string, depth: 'brief' | 'standard' | 'detailed' = 'standard'): Promise<ResearchResult> {
    console.log(`[${this.id}] Researching: ${topic} (${depth})`);

    const domainContext = this.getContext();

    const maxTokens = depth === 'brief' ? 500 : depth === 'detailed' ? 2048 : 1024;

    const systemPrompt = `You are a research analyst. Provide a ${depth} research synthesis on the given topic.
${domainContext ? `Domain context: ${domainContext.slice(0, 1000)}` : ''}

Return a JSON object with this exact structure:
{
  "summary": "2-3 paragraph synthesis of the topic",
  "keyFindings": ["finding 1", "finding 2", "finding 3", ...],
  "sources": ["type of source (e.g., academic, industry report, documentation)"],
  "confidence": 0.0-1.0 (how confident you are in the accuracy),
  "relatedTopics": ["related topic 1", "related topic 2", ...],
  "followUpQuestions": ["what else should be investigated 1", ...]
}

Be factual. Distinguish what is well-established from what is speculative.
Return ONLY the JSON.`;

    try {
      const result = await this.model.generate(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: topic },
        ],
        { maxTokens, temperature: 0.3, responseFormat: 'json' },
      );

      const parsed = this.parseJSON<any>(result.text, null);

      if (parsed) {
        return {
          topic,
          summary: parsed.summary || result.text.slice(0, 500),
          keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings : [],
          sources: Array.isArray(parsed.sources) ? parsed.sources : ['LLM synthesis'],
          confidence: this.clamp(parsed.confidence ?? 0.5),
          relatedTopics: Array.isArray(parsed.relatedTopics) ? parsed.relatedTopics : [],
          followUpQuestions: Array.isArray(parsed.followUpQuestions) ? parsed.followUpQuestions : [],
          researchedAt: Date.now(),
        };
      }

      // If JSON parsing fails, use the raw text as summary
      return {
        topic,
        summary: result.text,
        keyFindings: [],
        sources: ['LLM synthesis'],
        confidence: 0.4,
        relatedTopics: [],
        followUpQuestions: [],
        researchedAt: Date.now(),
      };
    } catch (err: any) {
      return {
        topic,
        summary: `Research failed: ${err.message}`,
        keyFindings: [],
        sources: [],
        confidence: 0,
        relatedTopics: [],
        followUpQuestions: [],
        researchedAt: Date.now(),
      };
    }
  }

  // ── Summarize (Real LLM summarization) ─────────────────────────────

  public async summarize(
    content: string,
    maxWords: number = 200,
    format: 'paragraph' | 'bullet' | 'executive' = 'paragraph',
  ): Promise<SummarizeResult> {
    console.log(`[${this.id}] Summarizing ${content.length} chars → ~${maxWords} words (${format})`);

    const formatInstruction = {
      paragraph: 'Write as 1-2 cohesive paragraphs.',
      bullet: 'Write as bullet points (use "- " prefix).',
      executive: 'Write as an executive summary: one-sentence bottom line, then key points.',
    }[format];

    const systemPrompt = `You are a summarization expert. Summarize the given content in at most ${maxWords} words.
${formatInstruction}
Preserve the key information. Be concise and precise. No filler.
Return ONLY the summary, no meta-text.`;

    try {
      const result = await this.model.generate(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: content.slice(0, 12000) }, // Limit input size
        ],
        { maxTokens: Math.min(1024, maxWords * 2), temperature: 0.2 },
      );

      // Also extract key points as bullet list
      let keyPoints: string[] = [];
      if (format !== 'bullet') {
        try {
          const kpResult = await this.model.generate(
            [
              {
                role: 'system',
                content: 'Extract the 3-5 key points from the following text. Return as a JSON array of strings. Only the JSON.',
              },
              { role: 'user', content: content.slice(0, 8000) },
            ],
            { maxTokens: 256, temperature: 0.2, responseFormat: 'json' },
          );
          const parsed = this.parseJSON<string[]>(kpResult.text, []);
          if (Array.isArray(parsed)) keyPoints = parsed;
        } catch {
          // Non-critical — skip key points
        }
      } else {
        // If bullet format, the summary itself is the key points
        keyPoints = result.text.split('\n').filter((l: string) => l.trim().startsWith('-')).map((l: string) => l.replace(/^-\s*/, '').trim());
      }

      const wordCount = result.text.split(/\s+/).length;

      return {
        summary: result.text,
        keyPoints,
        wordCount,
        compressionRatio: content.length > 0 ? Math.round((result.text.length / content.length) * 100) / 100 : 0,
      };
    } catch (err: any) {
      // Fallback: extract first N words
      const fallback = content.split(/\s+/).slice(0, maxWords).join(' ');
      return {
        summary: fallback,
        keyPoints: [],
        wordCount: fallback.split(/\s+/).length,
        compressionRatio: 0,
      };
    }
  }

  // ── Fact Check (Real LLM analysis) ─────────────────────────────────

  public async factCheck(claim: string, context?: string): Promise<FactCheckResult> {
    console.log(`[${this.id}] Fact-checking: ${claim.slice(0, 80)}`);

    const systemPrompt = `You are a fact-checker. Analyze the given claim and determine its veracity.
${context ? `Additional context: ${context}` : ''}

Return a JSON object:
{
  "verdict": "true" | "mostly_true" | "mixed" | "mostly_false" | "false" | "unverifiable",
  "confidence": 0.0-1.0,
  "reasoning": "why you reached this verdict (2-3 sentences)",
  "evidence": ["supporting or contradicting evidence point 1", ...],
  "sources": ["what type of sources would verify this", ...]
}

Be rigorous. If you cannot verify, say "unverifiable" — do not guess.
Return ONLY the JSON.`;

    try {
      const result = await this.model.generate(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: claim },
        ],
        { maxTokens: 512, temperature: 0.2, responseFormat: 'json' },
      );

      const parsed = this.parseJSON<any>(result.text, null);

      if (parsed) {
        const validVerdicts = ['true', 'mostly_true', 'mixed', 'mostly_false', 'false', 'unverifiable'];
        return {
          claim,
          verdict: validVerdicts.includes(parsed.verdict) ? parsed.verdict : 'unverifiable',
          confidence: this.clamp(parsed.confidence ?? 0.5),
          reasoning: parsed.reasoning || 'No reasoning provided.',
          evidence: Array.isArray(parsed.evidence) ? parsed.evidence : [],
          sources: Array.isArray(parsed.sources) ? parsed.sources : [],
          checkedAt: Date.now(),
        };
      }

      return {
        claim,
        verdict: 'unverifiable',
        confidence: 0.3,
        reasoning: 'Could not parse fact-check analysis.',
        evidence: [],
        sources: [],
        checkedAt: Date.now(),
      };
    } catch {
      return {
        claim,
        verdict: 'unverifiable',
        confidence: 0,
        reasoning: 'Fact-check failed — LLM unavailable.',
        evidence: [],
        sources: [],
        checkedAt: Date.now(),
      };
    }
  }

  // ── Compare (New — side-by-side analysis) ──────────────────────────

  public async compare(options: string[], criteria?: string[]): Promise<CompareResult> {
    console.log(`[${this.id}] Comparing ${options.length} options`);

    const criteriaStr = criteria && criteria.length > 0
      ? `Evaluate based on these criteria: ${criteria.join(', ')}`
      : 'Evaluate based on general usefulness, cost, complexity, and maturity.';

    const systemPrompt = `You are a comparison analyst. Compare the following options.
${criteriaStr}

Return a JSON object:
{
  "options": [
    {
      "name": "option name",
      "pros": ["advantage 1", ...],
      "cons": ["disadvantage 1", ...],
      "score": 0-100 (overall quality score),
      "notes": "any additional context"
    }
  ],
  "recommendation": "which option is best for general use",
  "recommendationReason": "why this option is recommended"
}

Be objective. Score based on the criteria, not personal preference.
Return ONLY the JSON.`;

    try {
      const result = await this.model.generate(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Options to compare:\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}` },
        ],
        { maxTokens: 1024, temperature: 0.3, responseFormat: 'json' },
      );

      const parsed = this.parseJSON<any>(result.text, null);

      if (parsed && Array.isArray(parsed.options)) {
        return {
          options: parsed.options.map((o: any) => ({
            name: o.name || 'Unknown',
            pros: Array.isArray(o.pros) ? o.pros : [],
            cons: Array.isArray(o.cons) ? o.cons : [],
            score: Math.max(0, Math.min(100, o.score ?? 0)),
            notes: o.notes || '',
          })),
          recommendation: parsed.recommendation || 'No recommendation',
          recommendationReason: parsed.recommendationReason || '',
          comparedAt: Date.now(),
        };
      }

      return {
        options: options.map(name => ({ name, pros: [], cons: [], score: 0, notes: 'Analysis failed' })),
        recommendation: 'Unable to compare',
        recommendationReason: 'LLM analysis failed',
        comparedAt: Date.now(),
      };
    } catch {
      return {
        options: options.map(name => ({ name, pros: [], cons: [], score: 0, notes: 'LLM unavailable' })),
        recommendation: 'Unable to compare',
        recommendationReason: 'LLM unavailable',
        comparedAt: Date.now(),
      };
    }
  }

  // ── Deep Dive (New — iterative research) ──────────────────────────

  public async deepDive(topic: string, subtopics?: string[]): Promise<{
    overview: ResearchResult;
    subtopicResearch: ResearchResult[];
  }> {
    console.log(`[${this.id}] Deep dive: ${topic} (${subtopics?.length || 0} subtopics)`);

    // Phase 1: Get overview
    const overview = await this.research(topic, 'detailed');

    // Phase 2: If no subtopics provided, use the follow-up questions
    const topics = subtopics && subtopics.length > 0
      ? subtopics
      : overview.followUpQuestions.slice(0, 3);

    // Phase 3: Research each subtopic
    const subtopicResearch: ResearchResult[] = [];
    for (const subtopic of topics) {
      const subResult = await this.research(
        `${topic}: ${subtopic}`,
        'standard',
      );
      subtopicResearch.push(subResult);
    }

    return { overview, subtopicResearch };
  }

  // ── Helpers ─────────────────────────────────────────────────────────

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

  private clamp(value: number): number {
    return Math.max(0, Math.min(1, value));
  }

  // ── Domain Context ───────────────────────────────────────────────────
  private context: string | null = null;

  public getContext(): string {
    if (!this.context) {
      this.context = ContextManager.loadDomainContext('Research');
    }
    return this.context;
  }

  public refreshContext(): void {
    this.context = null;
  }
}
