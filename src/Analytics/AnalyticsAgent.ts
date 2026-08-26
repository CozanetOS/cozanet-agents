// ── AnalyticsAgent — Real metric tracking + LLM insights ─────────────
//
// v0.3.0 — All methods now use real data:
//  - track(): Real metric storage (already was)
//  - report(): Real aggregation from tracked metrics + LLM insights
//  - trend(): Real trend analysis from tracked data
//  - generateInsights(): LLM-powered insights from real data
//  - aggregate(): Real aggregation (already was)
//  - export(): Real file export to JSON/CSV

import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';
import { ContextManager } from '../context/ContextManager';
import { ModelAdapter } from '../models/ModelAdapter';
import * as fs from 'fs';
import * as path from 'path';

export interface AnalyticsReport {
  metrics: Record<string, number>;
  trends: Array<{ metric: string; direction: 'up' | 'down' | 'stable'; change: number }>;
  insights: string[];
  period: { start: number; end: number };
  generatedAt: number;
}

interface MetricEntry {
  timestamp: number;
  value: number;
  tags: Record<string, string>;
}

/**
 * AnalyticsAgent — collects, aggregates, and visualizes metrics.
 */
export class AnalyticsAgent extends BaseAgent {
  private model: ModelAdapter;
  private metrics: Map<string, MetricEntry[]> = new Map();
  private dataDir: string;

  constructor(dataDir?: string) {
    super('agent:analytics', 'Analytics Agent', 'Metrics Collection & Data Insights');
    this.model = ModelAdapter.getInstance();
    this.dataDir = dataDir || path.join(process.cwd(), 'data', 'analytics');

    this.registerCapability({
      name: 'analytics',
      description: 'Track metrics, generate reports, analyze trends, and provide insights',
      taskTypes: ['track', 'report', 'trend', 'insights', 'aggregate', 'export'],
    });
  }

  protected onStart(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    this.load();
    console.log(`[${this.id}] Analytics Agent online — ${this.metrics.size} metrics tracked.`);
  }

  public async handle(task: AgentTask): Promise<any> {
    switch (task.type) {
      case 'track':
        return this.track(task.input.metric, task.input.value, task.input.tags);
      case 'report':
        return this.report(task.input.period, task.input.metrics);
      case 'trend':
        return this.trend(task.input.metric, task.input.period);
      case 'insights':
        return this.generateInsights(task.input.data);
      case 'aggregate':
        return this.aggregate(task.input.metric, task.input.operation, task.input.period);
      case 'export':
        return this.export(task.input.format, task.input.period);
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  // ── Track (Real — already was, now persists) ───────────────────────

  public async track(metric: string, value: number, tags?: Record<string, string>): Promise<{ metric: string; tracked: boolean; total: number }> {
    if (!this.metrics.has(metric)) this.metrics.set(metric, []);
    this.metrics.get(metric)!.push({ timestamp: Date.now(), value, tags: tags || {} });
    this.save();
    return { metric, tracked: true, total: this.metrics.get(metric)!.length };
  }

  // ── Report (Real — from tracked data + LLM insights) ────────────────

  public async report(period?: { start: number; end: number }, metrics?: string[]): Promise<AnalyticsReport> {
    const start = period?.start || Date.now() - 86400000; // Default: last 24h
    const end = period?.end || Date.now();
    console.log(`[${this.id}] Generating report for period ${new Date(start).toISOString()} → ${new Date(end).toISOString()}`);

    const metricNames = metrics || Array.from(this.metrics.keys());
    const reportMetrics: Record<string, number> = {};
    const trends: AnalyticsReport['trends'] = [];

    for (const name of metricNames) {
      const entries = this.metrics.get(name) || [];
      const inPeriod = entries.filter(e => e.timestamp >= start && e.timestamp <= end);

      if (inPeriod.length > 0) {
        const avg = inPeriod.reduce((a, b) => a + b.value, 0) / inPeriod.length;
        reportMetrics[name] = Math.round(avg * 100) / 100;

        // Calculate trend
        const firstHalf = inPeriod.slice(0, Math.floor(inPeriod.length / 2));
        const secondHalf = inPeriod.slice(Math.floor(inPeriod.length / 2));
        const firstAvg = firstHalf.length ? firstHalf.reduce((a, b) => a + b.value, 0) / firstHalf.length : 0;
        const secondAvg = secondHalf.length ? secondHalf.reduce((a, b) => a + b.value, 0) / secondHalf.length : 0;
        const change = firstAvg > 0 ? Math.round(((secondAvg - firstAvg) / firstAvg) * 100) : 0;

        trends.push({
          metric: name,
          direction: change > 5 ? 'up' : change < -5 ? 'down' : 'stable',
          change,
        });
      }
    }

    // LLM-powered insights
    let insights: string[] = [];
    try {
      const dataStr = Object.entries(reportMetrics)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      const trendStr = trends.map(t => `${t.metric}: ${t.direction} (${t.change}%)`).join(', ');

      const result = await this.model.generate([
        {
          role: 'system',
          content: 'You are an analytics insights generator. Given metrics and trends, provide 2-3 actionable insights. Return a JSON array of strings. Only JSON.',
        },
        { role: 'user', content: `Metrics: ${dataStr}\nTrends: ${trendStr}` },
      ], { maxTokens: 256, temperature: 0.3, responseFormat: 'json' });

      insights = this.parseJSON<string[]>(result.text, []);
    } catch {
      // Fallback: rule-based insights
      insights = trends.map(t => `${t.metric} is ${t.direction} (${t.change > 0 ? '+' : ''}${t.change}%)`);
    }

    return {
      metrics: reportMetrics,
      trends,
      insights,
      period: { start, end },
      generatedAt: Date.now(),
    };
  }

  // ── Trend (Real — from tracked data) ─────────────────────────────────

  public async trend(metric: string, period?: { start: number; end: number }): Promise<{ metric: string; direction: string; values: Array<{ timestamp: number; value: number }>; change: number }> {
    console.log(`[${this.id}] Trend analysis for ${metric}`);

    const start = period?.start || Date.now() - 86400000;
    const end = period?.end || Date.now();

    const entries = this.metrics.get(metric) || [];
    const inPeriod = entries.filter(e => e.timestamp >= start && e.timestamp <= end);

    if (inPeriod.length === 0) {
      return { metric, direction: 'no_data', values: [], change: 0 };
    }

    // Calculate direction
    const firstVal = inPeriod[0].value;
    const lastVal = inPeriod[inPeriod.length - 1].value;
    const change = firstVal > 0 ? Math.round(((lastVal - firstVal) / firstVal) * 100) : 0;
    const direction = change > 5 ? 'up' : change < -5 ? 'down' : 'stable';

    return {
      metric,
      direction,
      values: inPeriod.map(e => ({ timestamp: e.timestamp, value: e.value })),
      change,
    };
  }

  // ── Generate Insights (LLM-powered) ─────────────────────────────────

  public async generateInsights(data: any): Promise<{ insights: string[] }> {
    console.log(`[${this.id}] Generating insights from data`);

    try {
      const dataStr = typeof data === 'string' ? data : JSON.stringify(data).slice(0, 5000);

      const result = await this.model.generate([
        {
          role: 'system',
          content: 'You are an analytics insights generator. Analyze the given data and provide 3-5 actionable insights. Return a JSON array of strings. Only JSON.',
        },
        { role: 'user', content: dataStr },
      ], { maxTokens: 512, temperature: 0.3, responseFormat: 'json' });

      const insights = this.parseJSON<string[]>(result.text, []);
      return { insights: insights.length > 0 ? insights : ['No significant patterns detected in the data'] };
    } catch {
      return { insights: ['Insights generation failed — LLM unavailable'] };
    }
  }

  // ── Aggregate (Real — already was) ─────────────────────────────────

  public async aggregate(
    metric: string,
    operation: 'sum' | 'avg' | 'min' | 'max' | 'count',
    period?: { start: number; end: number },
  ): Promise<{ metric: string; operation: string; result: number; count: number }> {
    const entries = this.metrics.get(metric) || [];
    const inPeriod = period
      ? entries.filter(e => e.timestamp >= period.start && e.timestamp <= period.end)
      : entries;

    const nums = inPeriod.map(v => v.value);
    let result = 0;
    switch (operation) {
      case 'sum': result = nums.reduce((a, b) => a + b, 0); break;
      case 'avg': result = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0; break;
      case 'min': result = nums.length ? Math.min(...nums) : 0; break;
      case 'max': result = nums.length ? Math.max(...nums) : 0; break;
      case 'count': result = nums.length; break;
    }
    return { metric, operation, result: Math.round(result * 100) / 100, count: nums.length };
  }

  // ── Export (Real — writes to file) ─────────────────────────────────

  public async export(format: 'json' | 'csv', period?: { start: number; end: number }): Promise<{ format: string; path: string; size: number }> {
    console.log(`[${this.id}] Exporting as ${format}`);

    const start = period?.start || Date.now() - 86400000;
    const end = period?.end || Date.now();

    const exportData: Record<string, any> = {};
    for (const [metric, entries] of this.metrics.entries()) {
      const inPeriod = entries.filter(e => e.timestamp >= start && e.timestamp <= end);
      if (inPeriod.length > 0) exportData[metric] = inPeriod;
    }

    const filename = `analytics-${Date.now()}.${format}`;
    const filepath = path.join(this.dataDir, filename);

    if (format === 'json') {
      fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));
    } else {
      // CSV
      const rows = ['timestamp,metric,value,tags'];
      for (const [metric, entries] of Object.entries(exportData)) {
        for (const entry of entries as any[]) {
          rows.push(`${entry.timestamp},${metric},${entry.value},${JSON.stringify(entry.tags)}`);
        }
      }
      fs.writeFileSync(filepath, rows.join('\n'));
    }

    const size = fs.statSync(filepath).size;
    return { format, path: filepath, size };
  }

  // ── Persistence ─────────────────────────────────────────────────────

  private save(): void {
    if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
    const data = Array.from(this.metrics.entries());
    fs.writeFileSync(path.join(this.dataDir, 'metrics.json'), JSON.stringify(data, null, 2));
  }

  private load(): void {
    const filePath = path.join(this.dataDir, 'metrics.json');
    if (!fs.existsSync(filePath)) return;
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      for (const [metric, entries] of data) {
        this.metrics.set(metric, entries);
      }
    } catch { /* start fresh */ }
  }

  // ── Domain Context ───────────────────────────────────────────────────
  private context: string | null = null;

  public getContext(): string {
    if (!this.context) {
      this.context = ContextManager.loadDomainContext('Cozanet Company');
    }
    return this.context;
  }

  public refreshContext(): void {
    this.context = null;
  }

  private parseJSON<T>(text: string, fallback: T): T {
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    try { return JSON.parse(cleaned) as T; } catch { return fallback; }
  }
}
