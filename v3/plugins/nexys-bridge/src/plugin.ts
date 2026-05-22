/**
 * Nexys Bridge Plugin
 *
 * Main ClaudeFlowPlugin implementation that bridges Ruflo's agent orchestration
 * to Python-based frameworks (NecroSwarm, NeuroSwarm, VoidTether, Capital-Sentience)
 * via JSON-RPC over child process stdio.
 *
 * Implements the ClaudeFlowPlugin interface for integration into the Ruflo
 * plugin system. Follows patterns from plugin-agent-federation architecture.
 */

import { FrameworkManager, type NexysFrameworkConfig } from './framework-manager.js';
import {
  NexysProtocolError,
  type NexysProtocolClientOptions,
} from './protocol.js';
import { createNexysBridgeTools, type MCPTool, type MCPToolProvider, type MCPToolResult } from './mcp-tools.js';
import {
  registerNexysAgents,
  type NexysAgentTypeDefinition,
  type NexysContextAgentRegistry,
} from './agents.js';

// ============================================================================
// Plugin Context Interfaces (self-contained for standalone plugin)
// ============================================================================

/** Logger interface (matching shared plugin-interface.ts) */
export interface ILogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/** Event bus interface */
export interface IEventBus {
  on(event: string, listener: (...args: unknown[]) => void): void;
  off(event: string, listener: (...args: unknown[]) => void): void;
  emit(event: string, ...args: unknown[]): boolean;
}

/** Service container */
export interface ServiceContainer {
  register<T>(name: string, service: T): void;
  get<T>(name: string): T | undefined;
  has(name: string): boolean;
  getServiceNames(): string[];
}

/** Plugin configuration */
export interface PluginConfig {
  [key: string]: unknown;
  features?: Record<string, boolean>;
  resources?: {
    maxMemoryMb?: number;
    maxCpuPercent?: number;
  };
}

/** Plugin context provided during initialization */
export interface PluginContext {
  config: PluginConfig;
  eventBus: IEventBus;
  logger: ILogger;
  services: ServiceContainer;
}

// ============================================================================
// Agent Type Definition (matching shared types)
// ============================================================================

/** Agent type definition compatible with shared plugin-interface.ts */
export interface AgentTypeDefinition {
  type: string;
  name: string;
  description: string;
  defaultConfig: Record<string, unknown>;
  requiredCapabilities?: string[];
  metadata?: Record<string, unknown>;
}

// ============================================================================
// MCP Tool Definition (matching shared types)
// ============================================================================

/** MCP tool definition compatible with shared plugin-interface.ts */
export interface MCPToolDefinition extends MCPTool {
  pluginName?: string;
  version?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Extension Point
// ============================================================================

/** Extension point definition for agent lifecycle hooks */
export interface ExtensionPoint {
  name: string;
  handler: (context: unknown) => Promise<unknown>;
  priority?: number;
}

// ============================================================================
// Nexys Bridge Plugin Config
// ============================================================================

/** Per-framework configuration in plugin config */
export interface NexysFrameworkPluginConfig {
  name: string;
  serverPath: string;
  args?: string[];
  timeout?: number;
  config?: Record<string, unknown>;
}

/** Expected plugin configuration shape under "nexys" key */
export interface NexysPluginConfig {
  frameworks?: NexysFrameworkPluginConfig[];
  maxRestarts?: number;
  restartDelayMs?: number;
}

// ============================================================================
// ClaudeFlowPlugin Interface (self-contained, matching shared)
// ============================================================================

export interface ClaudeFlowPlugin {
  readonly name: string;
  readonly version: string;
  readonly dependencies?: string[];
  readonly description?: string;
  readonly author?: string;
  initialize(context: PluginContext): Promise<void>;
  shutdown(): Promise<void>;
  registerAgentTypes?(): AgentTypeDefinition[];
  registerMCPTools?(): MCPToolDefinition[];
  healthCheck?(): Promise<boolean>;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Nexys Bridge Plugin
// ============================================================================

export class NexysBridgePlugin implements ClaudeFlowPlugin {
  readonly name = '@ruflo/plugin-nexys-bridge';
  readonly version = '1.0.0-alpha.1';
  readonly description = 'Bridges Ruflo agent orchestration to Python frameworks via JSON-RPC over stdio';
  readonly author = 'Ruflo Team';
  readonly dependencies: string[] = [];

  private context: PluginContext | null = null;
  private frameworkManager: FrameworkManager;
  private mcpToolProvider: MCPToolProvider | null = null;
  private registeredAgentTypes: AgentTypeDefinition[] = [];
  private initialized = false;
  private logger: ILogger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };

  // Extension point interceptors
  private extensionPoints: ExtensionPoint[] = [];

  constructor() {
    this.frameworkManager = new FrameworkManager({
      maxRestarts: 3,
      restartDelayMs: 1000,
    });
  }

  /**
   * Initialize the plugin — read config, spawn framework processes,
   * discover capabilities, register agent types and MCP tools.
   */
  async initialize(context: PluginContext): Promise<void> {
    this.context = context;
    this.logger = context.logger;
    this.logger.info('[nexys-bridge] Initializing Nexys Bridge Plugin');

    // Parse plugin configuration
    const nexysConfig = this.parseConfig(context.config);

    // Override framework manager settings from config
    if (nexysConfig.maxRestarts !== undefined) {
      this.frameworkManager = new FrameworkManager({
        maxRestarts: nexysConfig.maxRestarts,
        restartDelayMs: nexysConfig.restartDelayMs ?? 1000,
      });
    }

    // Initialize each framework
    const frameworks = nexysConfig.frameworks ?? [];
    this.logger.info(`[nexys-bridge] Connecting to ${frameworks.length} framework(s)`);

    for (const fwCfg of frameworks) {
      try {
        this.logger.info(`[nexys-bridge] Connecting to "${fwCfg.name}" at ${fwCfg.serverPath}`);
        const discovery = await this.frameworkManager.addFramework({
          name: fwCfg.name,
          serverPath: fwCfg.serverPath,
          args: fwCfg.args,
          timeout: fwCfg.timeout,
          config: fwCfg.config,
        });
        this.logger.info(
          `[nexys-bridge] Connected to "${fwCfg.name}" (v${discovery.version}), ` +
          `${discovery.capabilities.length} capabilities, ${discovery.methods.length} methods`,
        );
      } catch (err) {
        this.logger.error(
          `[nexys-bridge] Failed to connect to "${fwCfg.name}": ` +
          `${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // Register discovered frameworks as agent types
    this.registerAgentTypesInRegistry();

    // Create MCP tool provider
    this.mcpToolProvider = createNexysBridgeTools(this.frameworkManager);

    // Register extension points for agent lifecycle
    this.registerLifecycleExtensionPoints(context);

    // Register framework manager as an accessible service
    try {
      context.services.register('nexysBridge', this.frameworkManager);
    } catch {
      this.logger.debug('[nexys-bridge] Could not register nexysBridge service');
    }

    this.initialized = true;
    this.logger.info(
      `[nexys-bridge] Initialization complete — ` +
      `${this.frameworkManager.count} framework(s), ${this.registeredAgentTypes.length} agent type(s)`,
    );
  }

  /**
   * Shutdown the plugin — terminate all Python child processes gracefully.
   */
  async shutdown(): Promise<void> {
    this.logger.info('[nexys-bridge] Shutting down Nexys Bridge Plugin');
    this.initialized = false;

    // Unregister extension points
    if (this.context) {
      for (const ep of this.extensionPoints) {
        try {
          this.context.eventBus.off(`ext:${ep.name}`, ep.handler);
        } catch { /* ignore */ }
      }
    }
    this.extensionPoints = [];

    await this.frameworkManager.shutdownAll();
    this.logger.info('[nexys-bridge] Shutdown complete');
  }

  /**
   * Register agent types discovered from Python frameworks.
   */
  registerAgentTypes(): AgentTypeDefinition[] {
    return this.registeredAgentTypes;
  }

  /**
   * Register MCP tools for Nexys Bridge operations.
   */
  registerMCPTools(): MCPToolDefinition[] {
    if (!this.mcpToolProvider) return [];

    const tools = this.mcpToolProvider.getTools?.() ?? [];
    return tools.map((tool) => ({
      ...tool,
      pluginName: this.name,
      version: this.version,
      metadata: { source: 'nexys-bridge' },
    }));
  }

  /**
   * Health check — verifies all frameworks are responsive.
   */
  async healthCheck(): Promise<boolean> {
    if (!this.initialized) return false;

    try {
      const results = await this.frameworkManager.healthCheckAll();
      for (const [, status] of results) {
        if (!status.healthy) return false;
      }
      return results.size > 0;
    } catch {
      return false;
    }
  }

  /** Plugin metadata */
  metadata: Record<string, unknown> = {
    category: 'agent-bridge',
    tags: ['nexys', 'python', 'json-rpc', 'child-process', 'agent-framework'],
    supportedFrameworks: [
      'necroswarm',
      'neuroswarm',
      'voidtether',
      'capital-sentience',
    ],
    protocol: 'json-rpc-2.0',
    transport: 'child-process-stdio',
  };

  /**
   * Forward a method call to a specific framework (for programmatic use).
   */
  async forwardToFramework(
    frameworkId: string,
    method: string,
    params?: unknown[] | Record<string, unknown>,
  ): Promise<unknown> {
    return this.frameworkManager.forwardCall(frameworkId, method, params);
  }

  // ========================================================================
  // Private Helpers
  // ========================================================================

  private parseConfig(config: PluginConfig): NexysPluginConfig {
    const nexys = config.nexys as NexysPluginConfig | undefined;
    return nexys ?? {};
  }

  /**
   * Register discovered frameworks as agent types in the Ruflo registry.
   * Uses context.services to find the agent registry if available,
   * otherwise stores types for registerAgentTypes() return.
   */
  private registerAgentTypesInRegistry(): void {
    if (!this.context) return;

    // Try to get the agent registry from the service container
    const agentRegistry = this.context.services.get<NexysContextAgentRegistry>('agentRegistry');

    if (agentRegistry) {
      this.registeredAgentTypes = registerNexysAgents(agentRegistry, this.frameworkManager)
        .map((nexysType) => this.toAgentTypeDefinition(nexysType));
    } else {
      // No registry available — build types from framework data for registerAgentTypes()
      this.registeredAgentTypes = this.frameworkManager
        .listFrameworks()
        .filter((fw) => fw.healthy && fw.discovery)
        .map((fw) => {
          const capabilityNames = fw.discovery!.capabilities.map((c) => c.name);
          return {
            type: `nexys:${fw.name.toLowerCase()}`,
            name: `${fw.name.charAt(0).toUpperCase() + fw.name.slice(1)} Agent`,
            description: `Nexys-bridged agent powered by ${fw.name} (v${fw.discovery!.version})`,
            defaultConfig: {
              type: `nexys:${fw.name.toLowerCase()}`,
              capabilities: capabilityNames,
              metadata: {
                nexysFramework: fw.name,
                nexysVersion: fw.discovery!.version,
              },
            },
            requiredCapabilities: capabilityNames,
            metadata: {
              framework: fw.name,
              version: fw.discovery!.version,
              healthy: fw.healthy,
            },
          };
        });
    }
  }

  private toAgentTypeDefinition(nexysType: NexysAgentTypeDefinition): AgentTypeDefinition {
    return {
      type: nexysType.type,
      name: nexysType.name,
      description: nexysType.description,
      defaultConfig: nexysType.defaultConfig as Record<string, unknown>,
      requiredCapabilities: nexysType.requiredCapabilities,
      metadata: nexysType.metadata,
    };
  }

  /**
   * Register extension points for agent lifecycle events.
   * Intercepts agent.beforeSpawn and agent.beforeTerminate for Nexys agents.
   */
  private registerLifecycleExtensionPoints(context: PluginContext): void {
    // agent.beforeSpawn — intercept spawns for nexys-registered agent types
    const beforeSpawnHandler = async (spawnContext: unknown) => {
      const ctx = spawnContext as Record<string, unknown> | undefined;
      if (!ctx) return spawnContext;

      const agentType = ctx.type as string | undefined;
      if (!agentType?.startsWith('nexys:')) return spawnContext;

      this.logger.debug(`[nexys-bridge] Intercepted agent.beforeSpawn for ${agentType}`);

      // Optionally enrich spawn context with framework metadata
      const frameworkName = agentType.replace('nexys:', '');
      const fw = this.frameworkManager.getFramework(frameworkName);

      if (fw && fw.discovery) {
        return {
          ...ctx,
          nexysFramework: fw.name,
          nexysCapabilities: fw.discovery.capabilities,
          nexysVersion: fw.discovery.version,
        };
      }

      return spawnContext;
    };

    context.eventBus.on('ext:agent.beforeSpawn', beforeSpawnHandler);
    this.extensionPoints.push({
      name: 'agent.beforeSpawn',
      handler: beforeSpawnHandler,
      priority: 50,
    });

    // agent.beforeTerminate — intercept termination for nexys agents
    const beforeTerminateHandler = async (terminateContext: unknown) => {
      const ctx = terminateContext as Record<string, unknown> | undefined;
      if (!ctx) return terminateContext;

      const agentId = ctx.agentId as string | undefined;
      const agentType = ctx.type as string | undefined;

      if (!agentType?.startsWith('nexys:')) return terminateContext;

      this.logger.debug(
        `[nexys-bridge] Intercepted agent.beforeTerminate for ${agentType} (${agentId})`,
      );

      // Notify the framework about agent termination if needed
      const frameworkName = agentType.replace('nexys:', '');
      const fw = this.frameworkManager.getFramework(frameworkName);

      if (fw && fw.healthy) {
        try {
          await fw.client.call('agent.terminate', {
            agentId,
            frameworkName,
          });
        } catch (err) {
          this.logger.warn(
            `[nexys-bridge] Failed to notify ${frameworkName} about agent termination: ` +
            `${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      return terminateContext;
    };

    context.eventBus.on('ext:agent.beforeTerminate', beforeTerminateHandler);
    this.extensionPoints.push({
      name: 'agent.beforeTerminate',
      handler: beforeTerminateHandler,
      priority: 50,
    });

    this.logger.debug('[nexys-bridge] Registered agent lifecycle extension points');
  }
}

// Default export for plugin loading
export default NexysBridgePlugin;
