// ============================================================================
// TaskRunner — Visible Command Windows + Background Execution
// ============================================================================

export type RunStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

export type RunKind = 'command' | 'browser' | 'agent_task' | 'workflow' | 'api_call';

export interface CommandWindow {
  id: string;
  kind: RunKind;
  title: string;
  status: RunStatus;
  startedAt: number;
  finishedAt?: number;
  output: LogEntry[];
  visible: boolean;          // should this be shown in the UI right now?
  autoDismiss: boolean;      // dismiss the window when done?
  dismissAfterMs?: number;   // how long to keep it visible after completion (default: 3000)
  browserSession?: BrowserSession;  // if kind === 'browser'
  agentId?: string;
  taskType?: string;
  metadata?: Record<string, any>;
}

export interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'success' | 'stdout' | 'stderr';
  message: string;
  source?: string;
}

export interface BrowserSession {
  id: string;
  url: string;
  visible: boolean;           // true = show in app, false = headless
  screenshots: { timestamp: number; path: string }[];
  clicks: { timestamp: number; selector: string; success: boolean }[];
  typedInputs: { timestamp: number; selector: string; text: string }[];
  currentUrl: string;
  status: 'navigating' | 'interactive' | 'idle' | 'closed';
}

export interface RunOptions {
  visible?: boolean;          // default: true — show the window in the app
  autoDismiss?: boolean;      // default: true — hide window when done
  dismissAfterMs?: number;    // default: 3000 — keep window visible for X ms after done
  backgroundOnly?: boolean;   // default: false — if true, never show UI (pure background)
  timeoutMs?: number;
  onLog?: (entry: LogEntry) => void;
  onComplete?: (window: CommandWindow) => void;
  onStatusChange?: (window: CommandWindow) => void;
}

export interface RunHandle {
  windowId: string;
  promise: Promise<any>;
  cancel: () => void;
  getWindow: () => CommandWindow | null;
  appendLog: (level: LogEntry['level'], message: string, source?: string) => void;
}
