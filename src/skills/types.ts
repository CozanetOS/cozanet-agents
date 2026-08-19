// ── Shared types for SkillRegistry ────────────────────────────────────

import { PermissionLevel } from '../approvals/types';
export { PermissionLevel };

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  capabilities: string[];
  permissionLevel: PermissionLevel;
  tools: string[]; // tool IDs from ToolRegistry
  domain: string; // context domain (AEGIS, Trading, Security, etc.)
}

export type SkillExecutionStatus = 'pending' | 'running' | 'done' | 'failed';

export interface SkillExecution {
  skillId: string;
  agentId: string;
  input: any;
  output?: any;
  status: SkillExecutionStatus;
  startedAt: number;
  completedAt?: number;
  error?: string;
}
