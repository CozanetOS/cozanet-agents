import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';

export interface LearningProfile {
  userId: string;
  preferences: Record<string, any>;
  habits: { name: string; frequency: string; lastObserved: number }[];
  adaptationScore: number;
}

/**
 * LearningAgent — continuous preference profiling and habit tracking.
 * Tracks user behavior patterns, adapts responses, and personalizes experiences.
 */
export class LearningAgent extends BaseAgent {
  private profiles: Map<string, LearningProfile> = new Map();

  constructor() {
    super('agent:learning', 'Learning Agent', 'Continuous Personal Profiling & Adaptation');

    this.registerCapability({
      name: 'learning',
      description: 'Track preferences, learn habits, adapt behavior, and personalize',
      taskTypes: ['learn', 'profile', 'adapt', 'forget_user', 'get_preferences'],
    });
  }

  protected onStart(): void {
    console.log(`[${this.id}] Learning Agent online — profiling and adapting.`);
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

  private async learn(userId: string, observation: { type: string; data: any }): Promise<{ learned: boolean; profile: LearningProfile }> {
    console.log(`[${this.id}] Learning from ${userId}: ${observation.type}`);
    let profile = this.profiles.get(userId);
    if (!profile) {
      profile = { userId, preferences: {}, habits: [], adaptationScore: 0 };
      this.profiles.set(userId, profile);
    }

    if (observation.type === 'preference') {
      profile.preferences[observation.data.key] = observation.data.value;
    } else if (observation.type === 'habit') {
      const existing = profile.habits.find(h => h.name === observation.data.name);
      if (existing) {
        existing.lastObserved = Date.now();
      } else {
        profile.habits.push({ name: observation.data.name, frequency: observation.data.frequency || 'daily', lastObserved: Date.now() });
      }
    }
    profile.adaptationScore = Math.min(100, profile.adaptationScore + 1);

    return { learned: true, profile };
  }

  private async getProfile(userId: string): Promise<LearningProfile | null> {
    return this.profiles.get(userId) || null;
  }

  private async adapt(userId: string, context: any): Promise<{ adaptations: string[] }> {
    const profile = this.profiles.get(userId);
    if (!profile) return { adaptations: [] };
    const adaptations = Object.entries(profile.preferences).map(([k, v]) => `${k}=${v}`);
    return { adaptations };
  }

  private async forgetUser(userId: string): Promise<{ forgotten: boolean }> {
    return { forgotten: this.profiles.delete(userId) };
  }

  private async getPreferences(userId: string): Promise<Record<string, any>> {
    return this.profiles.get(userId)?.preferences || {};
  }
}
