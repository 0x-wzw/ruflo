import { RufloPlugin, PluginContext } from 'ruflo';

/**
 * 0x-wzw Core Plugin
 * 
 * Meta-plugin that loads and coordinates all 7 adapter frameworks:
 * - NecroSwarm (workforce coordination)
 * - NeuroSwarm (brain + swarm dual-phase)
 * - Obliviarch (500x memory compression)
 * - VoidTether (interoperability mesh)
 * - OpenClaw (workflow orchestration)
 * - Memory Evolution (self-improving memory)
 * - Deterministic Retrieval (exact match)
 */

export interface AdapterFramework {
  name: string;
  version: string;
  status: 'active' | 'inactive' | 'error';
  adapter: any;
}

export class CorePlugin implements RufloPlugin {
  id = '0x-wzw-core';
  name = '0x-wzw Core';
  version = '1.0.0';
  
  private frameworks: Map<string, AdapterFramework> = new Map();
  private context?: PluginContext;

  async initialize(context: PluginContext): Promise<void> {
    this.context = context;
    
    // Load all 7 frameworks
    await this.loadFramework('necroswarm', 'ruflo-necroswarm');
    await this.loadFramework('neuroswarm', 'ruflo-neuroswarm');
    await this.loadFramework('obliviarch', 'ruflo-obliviarch');
    await this.loadFramework('voidtether', 'ruflo-voidtether');
    await this.loadFramework('openclaw', 'ruflo-openclaw');
    await this.loadFramework('memevolve', 'ruflo-memevolve');
    await this.loadFramework('detret', 'ruflo-detret');
    
    context.log.info('0x-wzw core: All 7 frameworks loaded');
  }

  private async loadFramework(id: string, packageName: string): Promise<void> {
    try {
      const module = await import(packageName);
      const adapter = new module.default();
      
      this.frameworks.set(id, {
        name: id,
        version: adapter.version || '1.0.0',
        status: 'active',
        adapter
      });
      
      this.context?.log.info(`Loaded ${id} adapter`);
    } catch (error) {
      this.frameworks.set(id, {
        name: id,
        version: '0.0.0',
        status: 'error',
        adapter: null
      });
      
      this.context?.log.warn(`Failed to load ${id}: ${error}`);
    }
  }

  async handleCommand(command: string, args: string[]): Promise<any> {
    switch (command) {
      case '0x-wzw-init':
        return this.initializeAll(args);
      case '0x-wzw-status':
        return this.getStatus();
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }

  private async initializeAll(args: string[]): Promise<any> {
    const results: Record<string, any> = {};
    
    for (const [id, framework] of this.frameworks) {
      if (framework.status === 'active' && framework.adapter.initialize) {
        try {
          results[id] = await framework.adapter.initialize();
        } catch (error) {
          results[id] = { error: String(error) };
        }
      }
    }
    
    return {
      status: 'initialized',
      frameworks: results
    };
  }

  private async getStatus(): Promise<any> {
    const status: Record<string, any> = {};
    
    for (const [id, framework] of this.frameworks) {
      status[id] = {
        name: framework.name,
        version: framework.version,
        status: framework.status
      };
    }
    
    return {
      core: this.version,
      frameworks: status,
      active: Array.from(this.frameworks.values()).filter(f => f.status === 'active').length,
      total: this.frameworks.size
    };
  }

  getFramework(id: string): AdapterFramework | undefined {
    return this.frameworks.get(id);
  }

  getActiveFrameworks(): AdapterFramework[] {
    return Array.from(this.frameworks.values())
      .filter(f => f.status === 'active');
  }
}

export default CorePlugin;
