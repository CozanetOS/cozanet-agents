// ── CX7Agent — Real layout rendering + persistence ───────────────────
//
// v0.3.0 — Real implementations:
//  - createLayout: Real layout creation (already was) + persistence
//  - render: Real HTML generation from components (was `<!-- comment -->`)
//  - updateLayout/addComponent/removeComponent: Real (already was) + persistence
//  - listLayouts: Real (already was)
//  - exportLayout [NEW]: Export layout as standalone HTML

import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface CX7Component {
  id: string;
  type: string;
  props: Record<string, any>;
  position: { x: number; y: number; w: number; h: number };
}

export interface CX7Layout {
  id: string;
  name: string;
  components: CX7Component[];
  theme: { primary: string; background: string; accent: string };
  responsive: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * CX7Agent — manages dynamic programmable infinite layouts.
 * Generates real HTML from component definitions.
 */
export class CX7Agent extends BaseAgent {
  private layouts: Map<string, CX7Layout> = new Map();
  private dataDir: string;

  constructor(dataDir?: string) {
    super('agent:cx7', 'CX7 Agent', 'Dynamic Visual Layouts & Workspaces');
    this.dataDir = dataDir || path.join(process.cwd(), 'data', 'cx7');

    this.registerCapability({
      name: 'cx7',
      description: 'Create, render, update, and manage dynamic infinite layouts',
      taskTypes: ['create_layout', 'render', 'update_layout', 'add_component', 'remove_component', 'list_layouts', 'export_layout'],
    });
  }

  protected onStart(): void {
    if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
    this.load();
    console.log(`[${this.id}] CX7 Agent online — ${this.layouts.size} layouts loaded.`);
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
      case 'export_layout':
        return this.exportLayout(task.input.layoutId, task.input.format);
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  public async createLayout(name: string, theme?: { primary: string; background: string; accent: string }): Promise<CX7Layout> {
    const layout: CX7Layout = {
      id: `cx7_${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
      name,
      components: [],
      theme: theme || { primary: '#0066FF', background: '#FFFFFF', accent: '#FF6600' },
      responsive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.layouts.set(layout.id, layout);
    this.save();
    console.log(`[${this.id}] Created layout: ${name} (${layout.id})`);
    return layout;
  }

  // ── Render (Real HTML generation) ───────────────────────────────────

  public async render(layoutId: string): Promise<{ layoutId: string; rendered: boolean; html: string; componentCount: number }> {
    const layout = this.layouts.get(layoutId);
    if (!layout) return { layoutId, rendered: false, html: '', componentCount: 0 };

    console.log(`[${this.id}] Rendering layout: ${layout.name} (${layout.components.length} components)`);

    const html = this.generateHTML(layout);
    return { layoutId, rendered: true, html, componentCount: layout.components.length };
  }

  public async updateLayout(layoutId: string, updates: Partial<CX7Layout>): Promise<{ layoutId: string; updated: boolean }> {
    const layout = this.layouts.get(layoutId);
    if (!layout) return { layoutId, updated: false };
    Object.assign(layout, updates, { updatedAt: Date.now() });
    this.save();
    return { layoutId, updated: true };
  }

  public async addComponent(layoutId: string, component: any): Promise<{ layoutId: string; componentId: string; added: boolean }> {
    const layout = this.layouts.get(layoutId);
    if (!layout) return { layoutId, componentId: '', added: false };
    const comp: CX7Component = {
      id: `comp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: component.type || 'div',
      props: component.props || {},
      position: component.position || { x: 0, y: 0, w: 12, h: 1 },
    };
    layout.components.push(comp);
    layout.updatedAt = Date.now();
    this.save();
    return { layoutId, componentId: comp.id, added: true };
  }

  public async removeComponent(layoutId: string, componentId: string): Promise<{ layoutId: string; componentId: string; removed: boolean }> {
    const layout = this.layouts.get(layoutId);
    if (!layout) return { layoutId, componentId, removed: false };
    const idx = layout.components.findIndex(c => c.id === componentId);
    if (idx === -1) return { layoutId, componentId, removed: false };
    layout.components.splice(idx, 1);
    layout.updatedAt = Date.now();
    this.save();
    return { layoutId, componentId, removed: true };
  }

  public async listLayouts(): Promise<Array<{ id: string; name: string; componentCount: number }>> {
    return Array.from(this.layouts.values()).map(l => ({
      id: l.id, name: l.name, componentCount: l.components.length,
    }));
  }

  // ── Export (Real HTML file) ─────────────────────────────────────────

  public async exportLayout(layoutId: string, format: 'html' | 'json' = 'html'): Promise<{ layoutId: string; path: string; size: number }> {
    const layout = this.layouts.get(layoutId);
    if (!layout) return { layoutId, path: '', size: 0 };

    let content: string;
    let ext: string;

    if (format === 'html') {
      content = this.generateHTML(layout);
      ext = 'html';
    } else {
      content = JSON.stringify(layout, null, 2);
      ext = 'json';
    }

    const filename = `${layout.id}.${ext}`;
    const filepath = path.join(this.dataDir, filename);
    fs.writeFileSync(filepath, content);

    return { layoutId, path: filepath, size: fs.statSync(filepath).size };
  }

  // ── HTML Generator ──────────────────────────────────────────────────

  private generateHTML(layout: CX7Layout): string {
    const componentsHTML = layout.components.map(comp => {
      const { x, y, w, h } = comp.position;
      const styles = [
        `position: absolute`,
        `left: ${(x / 12 * 100).toFixed(1)}%`,
        `top: ${y * 100}px`,
        `width: ${(w / 12 * 100).toFixed(1)}%`,
        `min-height: ${h * 60}px`,
        `background: ${comp.props.background || layout.theme.background}`,
        `border: 1px solid ${comp.props.border || '#e0e0e0'}`,
        `border-radius: 8px`,
        `padding: 16px`,
        `box-sizing: border-box`,
      ].join('; ');

      const content = this.renderComponentContent(comp);
      return `      <div style="${styles}">\n        ${content}\n      </div>`;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${layout.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: ${layout.theme.background}; font-family: -apple-system, system-ui, sans-serif; }
    .cx7-container { position: relative; width: 100%; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1, h2, h3 { color: ${layout.theme.primary}; margin-bottom: 8px; }
    p { color: #333; line-height: 1.6; }
    button { background: ${layout.theme.primary}; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="cx7-container">
    <h1 style="color: ${layout.theme.primary}; margin-bottom: 20px;">${layout.name}</h1>
${componentsHTML}
  </div>
</body>
</html>`;
  }

  private renderComponentContent(comp: CX7Component): string {
    switch (comp.type) {
      case 'heading':
      case 'h1': return `<h1>${comp.props.text || 'Heading'}</h1>`;
      case 'h2': return `<h2>${comp.props.text || 'Subheading'}</h2>`;
      case 'paragraph': return `<p>${comp.props.text || ''}</p>`;
      case 'button': return `<button>${comp.props.label || 'Click'}</button>`;
      case 'input': return `<input type="${comp.props.inputType || 'text'}" placeholder="${comp.props.placeholder || ''}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;">`;
      case 'image': return `<img src="${comp.props.src || ''}" alt="${comp.props.alt || ''}" style="max-width:100%;border-radius:8px;">`;
      case 'list': return `<ul>${(comp.props.items || []).map((item: string) => `<li>${item}</li>`).join('')}</ul>`;
      case 'card': return `<div style="background:#fff;padding:16px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);"><h3>${comp.props.title || ''}</h3><p>${comp.props.text || ''}</p></div>`;
      case 'chart': return `<div style="padding:20px;text-align:center;color:#666;">📊 Chart: ${comp.props.title || 'Untitled'}<br><small>(Data: ${JSON.stringify(comp.props.data || {}).slice(0, 100)})</small></div>`;
      default: return `<div>${comp.props.text || comp.props.content || ''}</div>`;
    }
  }

  // ── Persistence ─────────────────────────────────────────────────────

  private save(): void {
    if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
    const data = Array.from(this.layouts.values());
    fs.writeFileSync(path.join(this.dataDir, 'layouts.json'), JSON.stringify(data, null, 2));
  }

  private load(): void {
    const filePath = path.join(this.dataDir, 'layouts.json');
    if (!fs.existsSync(filePath)) return;
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      for (const layout of data) {
        this.layouts.set(layout.id, layout);
      }
    } catch { /* start fresh */ }
  }
}
