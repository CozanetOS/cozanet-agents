import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';

export interface CX7Layout {
  id: string;
  components: { id: string; type: string; props: Record<string, any>; position: { x: number; y: number; w: number; h: number } }[];
  theme: { primary: string; background: string; accent: string };
  responsive: boolean;
}

/**
 * CX7Agent — manages dynamic programmable infinite layouts.
 * Generates, renders, and manipulates visual workspace layouts.
 * Integration point: cozanet-cx7 engine.
 */
export class CX7Agent extends BaseAgent {
  private layouts: Map<string, CX7Layout> = new Map();

  constructor() {
    super('agent:cx7', 'CX7 Agent', 'Dynamic Visual Layouts & Workspaces');

    this.registerCapability({
      name: 'cx7',
      description: 'Create, render, update, and manage dynamic infinite layouts',
      taskTypes: ['create_layout', 'render', 'update_layout', 'add_component', 'remove_component', 'list_layouts'],
    });
  }

  protected onStart(): void {
    console.log(`[${this.id}] CX7 Agent online — managing visual layouts.`);
  }

  public async handle(task: AgentTask): Promise<any> {
    switch (task.type) {
      case 'create_layout':
        return this.createLayout(task.input.name, task.input.theme);
      case 'render':
        return this.render(task.input.layoutId);
      case 'update_layout':
        return this.updateLayout(task.input.layoutId, task.input.updates);
      case 'add_component':
        return this.addComponent(task.input.layoutId, task.input.component);
      case 'remove_component':
        return this.removeComponent(task.input.layoutId, task.input.componentId);
      case 'list_layouts':
        return this.listLayouts();
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  private async createLayout(name: string, theme?: { primary: string; background: string; accent: string }): Promise<CX7Layout> {
    const layout: CX7Layout = {
      id: `cx7:${name}:${Date.now()}`,
      components: [],
      theme: theme || { primary: '#0066FF', background: '#FFFFFF', accent: '#FF6600' },
      responsive: true,
    };
    this.layouts.set(layout.id, layout);
    console.log(`[${this.id}] Created layout: ${name} (${layout.id})`);
    return layout;
  }

  private async render(layoutId: string): Promise<{ layoutId: string; rendered: boolean; html: string }> {
    const layout = this.layouts.get(layoutId);
    if (!layout) return { layoutId, rendered: false, html: '' };
    console.log(`[${this.id}] Rendering layout: ${layoutId}`);
    return { layoutId, rendered: true, html: `<!-- CX7 layout ${layoutId} -->` };
  }

  private async updateLayout(layoutId: string, updates: Partial<CX7Layout>): Promise<{ layoutId: string; updated: boolean }> {
    const layout = this.layouts.get(layoutId);
    if (!layout) return { layoutId, updated: false };
    Object.assign(layout, updates);
    return { layoutId, updated: true };
  }

  private async addComponent(layoutId: string, component: any): Promise<{ layoutId: string; componentId: string; added: boolean }> {
    const layout = this.layouts.get(layoutId);
    if (!layout) return { layoutId, componentId: '', added: false };
    const comp = { id: `comp:${Date.now()}`, ...component };
    layout.components.push(comp);
    return { layoutId, componentId: comp.id, added: true };
  }

  private async removeComponent(layoutId: string, componentId: string): Promise<{ layoutId: string; componentId: string; removed: boolean }> {
    const layout = this.layouts.get(layoutId);
    if (!layout) return { layoutId, componentId, removed: false };
    const idx = layout.components.findIndex(c => c.id === componentId);
    if (idx === -1) return { layoutId, componentId, removed: false };
    layout.components.splice(idx, 1);
    return { layoutId, componentId, removed: true };
  }

  private async listLayouts(): Promise<string[]> {
    return Array.from(this.layouts.keys());
  }
}
