import { BaseAgent } from '../base/BaseAgent';
import { AgentTask } from '../types';

export interface DeviceInfo {
  id: string;
  name: string;
  type: string;
  status: 'online' | 'offline' | 'syncing' | 'error';
  lastSeen: number;
  capabilities: string[];
}

/**
 * DeviceAgent — manages local and remote connected devices.
 * Handles device registration, synchronization, capability discovery, and health monitoring.
 * Integration point: cozanet-device engine.
 */
export class DeviceAgent extends BaseAgent {
  private devices: Map<string, DeviceInfo> = new Map();

  constructor() {
    super('agent:device', 'Device Agent', 'Device Registry & Synchronization');

    this.registerCapability({
      name: 'device',
      description: 'Register, sync, monitor, and manage connected devices',
      taskTypes: ['register', 'unregister', 'sync', 'discover', 'health_check', 'list_devices'],
    });
  }

  protected onStart(): void {
    console.log(`[${this.id}] Device Agent online — managing devices.`);
  }

  public async handle(task: AgentTask): Promise<any> {
    switch (task.type) {
      case 'register':
        return this.register(task.input.device);
      case 'unregister':
        return this.unregister(task.input.deviceId);
      case 'sync':
        return this.sync(task.input.deviceId, task.input.data);
      case 'discover':
        return this.discover();
      case 'health_check':
        return this.healthCheck(task.input.deviceId);
      case 'list_devices':
        return this.listDevices();
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  private async register(device: { name: string; type: string; capabilities: string[] }): Promise<DeviceInfo> {
    const info: DeviceInfo = {
      id: `device:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      name: device.name,
      type: device.type,
      status: 'online',
      lastSeen: Date.now(),
      capabilities: device.capabilities,
    };
    this.devices.set(info.id, info);
    console.log(`[${this.id}] Registered device: ${device.name} (${info.id})`);
    return info;
  }

  private async unregister(deviceId: string): Promise<{ deviceId: string; removed: boolean }> {
    return { deviceId, removed: this.devices.delete(deviceId) };
  }

  private async sync(deviceId: string, data: any): Promise<{ deviceId: string; synced: boolean; timestamp: number }> {
    const device = this.devices.get(deviceId);
    if (!device) return { deviceId, synced: false, timestamp: Date.now() };
    device.status = 'syncing';
    device.lastSeen = Date.now();
    // Integration point: cozanet-device sync protocol
    setTimeout(() => { device.status = 'online'; }, 100);
    return { deviceId, synced: true, timestamp: Date.now() };
  }

  private async discover(): Promise<DeviceInfo[]> {
    console.log(`[${this.id}] Discovering devices on network`);
    return Array.from(this.devices.values());
  }

  private async healthCheck(deviceId: string): Promise<{ deviceId: string; healthy: boolean; latency?: number }> {
    const device = this.devices.get(deviceId);
    if (!device) return { deviceId, healthy: false };
    return { deviceId, healthy: device.status === 'online', latency: 50 };
  }

  private async listDevices(): Promise<DeviceInfo[]> {
    return Array.from(this.devices.values());
  }
}
