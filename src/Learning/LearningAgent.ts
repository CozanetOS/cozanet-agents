// ── LearningAgent — Real persistence + LLM adaptation ───────────────
//
// v0.3.0 — All methods now use real implementations:
//  - learn: Real preference/habit tracking + persistence (was in-memory only)
//  - getProfile: Real (already was) + loads from disk
//  - adapt: LLM-powered contextual adaptation (was just key=value strings)
//  - forgetUser: Real (already was) + removes from disk
//  - getPreferences: Real (already was)

import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';
import { ModelAdapter } from '../models/ModelAdapter';
import * as fs from 'fs';
import * as path from 'path';

export interface LearningProfile {
  userId: string;
  preferences: Record<string, any>;
  habits: Array<{ name: string; frequency: string; lastObserved: number; observationCount: number }>;
  adaptationScore: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * LearningAgent — continuous preference profiling and habit tracking.
 */
export class LearningAgent extends BaseAgent {
  private model: ModelAdapter;
  private profiles: Map<string, LearningProfile> = new Map();
  private dataDir: string;

  constructor(dataDir?: string) {
    super('agent:learning', 'Learning Agent', 'Continuous Personal Profiling & Adaptation');
    this.model = ModelAdapter.getInstance();
    this.dataDir = dataDir || path.join(process.cwd(), 'data', 'learning');

    this.registerCapability({
      name: 'learning',
      description: 'Track preferences, learn habits, adapt behavior, and personalize',
      taskTypes: ['learn', 'profile', 'adapt', 'forget_user', 'get_preferences'],
    });
  }

  protected onStart(): void {
    if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
    this.load();
    console.log(`[${this.id}] Learning Agent online — ${this.profiles.size} user profiles.`);
  }

  public async handle(task: AgentTask): Promise<any> {
    switch (task.type) {
      case 'learn':
        return this.learn(task.input.userId, task.input.observation);
      case 'profile':
        return this.getProfile(task.input.userId);
      case 'adapt':
        return this.adapt(task.input.userId, task.input.context);
      case 'forget_user':
        return this.forgetUser(task.input.userId);
      case 'get_preferences':
        return this.getPreferences(task.input.userId);
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  public async learn(userId: string, observation: { type: string; data: any }): Promise<{ learned: boolean; profile: LearningProfile }> {
    console.log(`[${this.id}] Learning from ${userId}: ${observation.type}`);

    let profile = this.profiles.get(userId);
    if (!profile) {
      profile = {
        userId, preferences: {}, habits: [],
        adaptationScore: 0,
        createdAt: Date.now(), updatedAt: Date.now(),
      };
      this.profiles.set(userId, profile);
    }

    if (observation.type === 'preference') {
      profile.preferences[observation.data.key] = observation.data.value;
    } else if (observation.type === 'habit') {
      const existing = profile.habits.find(h => h.name === observation.data.name);
      if (existing) {
        existing.lastObserved = Date.now();
        existing.observationCount++;
      } else {
        profile.habits.push({
          name: observation.data.name,
          frequency: observation.data.frequency || 'daily',
          lastObserved: Date.now(),
          observationCount: 1,
        });
      }
    }

    profile.adaptationScore = Math.min(100, profile.adaptationScore + 1);
    profile.updatedAt = Date.now();
    this.save();

    return { learned: true, profile };
  }

  public async getProfile(userId: string): Promise<LearningProfile | null> {
    return this.profiles.get(userId) || null;
  }

  public async adapt(userId: string, context: any): Promise<{ adaptations: string[]; reasoning: string }> {
    const profile = this.profiles.get(userId);
    if (!profile) return { adaptations: [], reasoning: 'No profile found for this user.' };

    // LLM-powered adaptation
    try {
      const prefsStr = JSON.stringify(profile.preferences);
      const habitsStr = profile.habits.map(h => `${h.name} (${h.frequency}, ${h.observationCount}x)`).join(', ');
      const contextStr = typeof context === 'string' ? context : JSON.stringify(context);

      const result = await this.model.generate([
        {
          role: 'system',
          content: `You are a personalization engine. Given a user's preferences, habits, and current context, suggest specific adaptations.
Return JSON: {"adaptations": ["specific adaptation 1", ...], "reasoning": "why these adaptations make sense"}
Return ONLY JSON.`,
        },
        { role: 'user', content: `Preferences: ${prefsStr}\nHabits: ${habitsStr}\nContext: ${contextStr}` },
      ], { maxTokens: 512, temperature: 0.3, responseFormat: 'json' });

      const parsed = this.parseJSON<any>(result.text, {});
      return {
        adaptations: Array.isArray(parsed.adaptations) ? parsed.adaptations : [],
        reasoning: parsed.reasoning || '',
      };
    } catch {
      // Fallback: rule-based adaptations
      const adaptations: string[] = [];
      for (const [key, value] of Object.entries(profile.preferences)) {
        adaptations.push(`Use ${value} for ${key} based on user preference`);
      }
      for (const habit of profile.habits.slice(0, 3)) {
        adaptations.push(`Account for habit: ${habit.name} (${habit.frequency})`);
      }
      return { adaptations, reasoning: 'Rule-based fallback (LLM unavailable)' };
    }
  }

  public async forgetUser(userId: string): Promise<{ forgotten: boolean }> {
    const deleted = this.profiles.delete(userId);
    if (deleted) this.save();
    return { forgotten: deleted };
  }

  public async getPreferences(userId: string): Promise<Record<string, any>> {
    return this.profiles.get(userId)?.preferences || {};
  }

  // ── Persistence ─────────────────────────────────────────────────────

  private save(): void {
    if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
    const data = Array.from(this.profiles.values());
    fs.writeFileSync(path.join(this.dataDir, 'profiles.json'), JSON.stringify(data, null, 2));
  }

  private load(): void {
    const filePath = path.join(this.dataDir, 'profiles.json');
    if (!fs.existsSync(filePath)) return;
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      for (const profile of data) {
        this.profiles.set(profile.userId, profile);
      }
    } catch { /* start fresh */ }
  }

  private parseJSON<T>(text: string, fallback: T): T {
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    try { return JSON.parse(cleaned) as T; } catch { return fallback; }
  }
}
