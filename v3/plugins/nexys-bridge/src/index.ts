/**
 * @ruflo/plugin-nexys-bridge
 *
 * Nexys Bridge Plugin for Ruflo — bridges agent orchestration to
 * Python-based frameworks (NecroSwarm, NeuroSwarm, VoidTether,
 * Capital-Sentience) via JSON-RPC over child process stdio.
 *
 * @example
 * ```typescript
 * import { NexysBridgePlugin } from '@ruflo/plugin-nexys-bridge';
 *
 * const plugin = new NexysBridgePlugin();
 *
 * // Initialize with frameworks config
 * await plugin.initialize({
 *   config: {
 *     nexys: {
 *       frameworks: [
 *         { name: 'necroswarm', serverPath: '/path/to/necroswarm/server.py' },
 *         { name: 'voidtether', serverPath: '/path/to/voidtether/server.py' },
 *       ],
 *     },
 *   },
 *   eventBus: myEventBus,
 *   logger: myLogger,
 *   services: myServiceContainer,
 * });
 *
 * // Forward calls to frameworks
 * const result = await plugin.forwardToFramework('necroswarm', 'agent.execute', {
 *   task: { taskId: 't1', objective: 'Analyze data' },
 * });
 *
 * // Shutdown
 * await plugin.shutdown();
 * ```
 *
 * @module @ruflo/plugin-nexys-bridge
 * @version 1.0.0-alpha.1
 */

// Core plugin class
export {
  NexysBridgePlugin,
  type ClaudeFlowPlugin,
  type PluginContext,
  type PluginConfig,
  type ILogger,
  type IEventBus,
  type ServiceContainer,
  type AgentTypeDefinition,
  type MCPToolDefinition,
  type ExtensionPoint,
  type NexysFrameworkPluginConfig,
  type NexysPluginConfig,
} from './plugin.js';

// Protocol types and client
export {
  NexysProtocolClient,
  NexysProtocolError,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type JsonRpcSuccessResponse,
  type JsonRpcErrorResponse,
  type JsonRpcNotification,
  type JsonRpcErrorObject,
  type FrameworkCapability,
  type FrameworkDiscovery,
  type AgentExecutionTask,
  type FrameworkMemoryEntry,
  type WorkflowResolutionRequest,
  type NexysProtocolClientOptions,
} from './protocol.js';

// Framework manager
export {
  FrameworkManager,
  type NexysFrameworkConfig,
  type FrameworkRuntime,
  type FrameworkManagerOptions,
} from './framework-manager.js';

// MCP tools
export {
  createNexysBridgeTools,
  NEXYS_BRIDGE_TOOL_DEFS,
  type MCPTool,
  type MCPToolResult,
  type MCPToolProvider,
} from './mcp-tools.js';

// Agent registration
export {
  registerNexysAgents,
  type NexysAgentTypeDefinition,
  type NexysContextAgentRegistry,
} from './agents.js';

// Default export
import { NexysBridgePlugin } from './plugin.js';
export default NexysBridgePlugin;
