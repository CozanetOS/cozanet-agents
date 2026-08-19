// ── Shared types for ToolRegistry ──────────────────────────────────────

import { PermissionLevel } from '../approvals/types';
export { PermissionLevel };

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
  default?: any;
  enum?: string[];
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
  permissionLevel: PermissionLevel;
  handler: (params: Record<string, any>) => Promise<any>;
  registeredBy: string; // agent id
  registeredAt: number;
}

export interface ToolExecutionResult {
  toolId: string;
  success: boolean;
  output?: any;
  error?: string;
  durationMs: number;
}

export interface ToolEvent {
  type: 'registered' | 'unregistered' | 'executed' | 'failed';
  toolId: string;
  timestamp: number;
  data?: any;
}
