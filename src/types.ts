export interface Agent {
  id: string;
  name: string;
  role: string;
  status: 'idle' | 'running' | 'paused' | 'error';
  capabilities: string[];
}

export interface AgentTask {
  id: string;
  agentId: string;
  type: string;
  input: any;
  output?: any;
  status: 'pending' | 'running' | 'done' | 'failed';
  createdAt: number;
  completedAt?: number;
}

export interface AgentMessage {
  from: string;
  to: string;
  type: string;
  payload: any;
}
