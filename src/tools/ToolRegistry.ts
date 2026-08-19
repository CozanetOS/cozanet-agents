import { ToolDefinition, ToolExecutionResult, ToolEvent, PermissionLevel } from './types';

type ToolEventHandler = (event: ToolEvent) => void;

/**
 * ToolRegistry — dynamic tool discovery and binding for CozanetOS agents.
 *
 * Agents register tools they can execute. Other agents can discover and
 * invoke them. Permission levels enforce the 3-tier model from the build spec.
 */
export class ToolRegistry {
  private static instance: ToolRegistry | null = null;
  private tools: Map<string, ToolDefinition> = new Map();
  private handlers: ToolEventHandler[] = [];

  private constructor() {}

  static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  // ── Registration ────────────────────────────────────────────────────
  registerTool(tool: Omit<ToolDefinition, 'registeredAt'>): ToolDefinition {
    const full: ToolDefinition = {
      ...tool,
      registeredAt: Date.now(),
    };
    this.tools.set(full.id, full);
    this.emit({ type: 'registered', toolId: full.id, timestamp: Date.now() });
    return full;
  }

  unregisterTool(toolId: string): boolean {
    const removed = this.tools.delete(toolId);
    if (removed) {
      this.emit({ type: 'unregistered', toolId, timestamp: Date.now() });
    }
    return removed;
  }

  // ── Retrieval ──────────────────────────────────────────────────────
  getTool(toolId: string): ToolDefinition | null {
    return this.tools.get(toolId) ?? null;
  }

  listTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  listToolsForPermissionLevel(level: PermissionLevel): ToolDefinition[] {
    return this.listTools().filter(t => t.permissionLevel === level);
  }

  // ── Discovery ──────────────────────────────────────────────────────
  discoverTools(keyword: string): ToolDefinition[] {
    const lower = keyword.toLowerCase();
    return this.listTools().filter(t =>
      t.name.toLowerCase().includes(lower) ||
      t.description.toLowerCase().includes(lower)
    );
  }

  // ── Execution ─────────────────────────────────────────────────────
  async executeTool(toolId: string, params: Record<string, any>): Promise<ToolExecutionResult> {
    const start = Date.now();
    const tool = this.tools.get(toolId);

    if (!tool) {
      return { toolId, success: false, error: `Tool "${toolId}" not found`, durationMs: 0 };
    }

    // Validate required parameters
    for (const [paramName, paramDef] of Object.entries(tool.parameters)) {
      if (paramDef.required && !(paramName in params)) {
        return {
          toolId,
          success: false,
          error: `Missing required parameter: ${paramName}`,
          durationMs: Date.now() - start,
        };
      }
    }

    try {
      const output = await tool.handler(params);
      this.emit({ type: 'executed', toolId, timestamp: Date.now(), data: { params } });
      return { toolId, success: true, output, durationMs: Date.now() - start };
    } catch (err: any) {
      this.emit({ type: 'failed', toolId, timestamp: Date.now(), data: { error: err.message } });
      return { toolId, success: false, error: err.message, durationMs: Date.now() - start };
    }
  }

  // ── Events ─────────────────────────────────────────────────────────
  on(handler: ToolEventHandler): void {
    this.handlers.push(handler);
  }

  private emit(event: ToolEvent): void {
    for (const h of this.handlers) {
      try { h(event); } catch { /* swallow */ }
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────────
  clear(): void {
    this.tools.clear();
  }
}
