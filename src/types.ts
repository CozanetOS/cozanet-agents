// ============================================================================
// CozanetOS Agent Framework — Core Types
// @cozanet/agents v0.2.0
// ============================================================================

export type AgentStatus = 'idle' | 'running' | 'paused' | 'error' | 'terminated';
export type TaskStatus = 'pending' | 'queued' | 'running' | 'done' | 'failed' | 'cancelled' | 'timeout';
export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

export interface AgentCapability {
  name: string;
  description?: string;
  taskTypes: string[];
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  capabilities: AgentCapability[];
  uptime: number;
  lastActive: number;
  tasksCompleted: number;
  tasksFailed: number;
}

export interface AgentTask {
  id: string;
  agentId: string;
  type: string;
  input: any;
  output?: any;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  timeoutMs?: number;
  retries: number;
  maxRetries: number;
  parentTaskId?: string;
  metadata?: Record<string, any>;
}

export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: string;
  payload: any;
  timestamp: number;
  replyTo?: string;
}

export interface TaskResult {
  taskId: string;
  agentId: string;
  status: TaskStatus;
  output?: any;
  error?: string;
  durationMs: number;
}

export interface AgentHealth {
  agentId: string;
  status: AgentStatus;
  healthy: boolean;
  lastHeartbeat: number;
  tasksCompleted: number;
  tasksFailed: number;
  errorRate: number;
}

export type AgentEvent =
  | { type: 'agent:started'; agentId: string; timestamp: number }
  | { type: 'agent:stopped'; agentId: string; timestamp: number }
  | { type: 'agent:error'; agentId: string; error: string; timestamp: number }
  | { type: 'task:queued'; taskId: string; agentId: string; timestamp: number }
  | { type: 'task:started'; taskId: string; agentId: string; timestamp: number }
  | { type: 'task:completed'; taskId: string; agentId: string; durationMs: number; timestamp: number }
  | { type: 'task:failed'; taskId: string; agentId: string; error: string; timestamp: number }
  | { type: 'message:sent'; message: AgentMessage }
  | { type: 'message:received'; message: AgentMessage };

export type EventHandler = (event: AgentEvent) => void;
