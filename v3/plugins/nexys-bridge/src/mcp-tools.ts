/**
 * MCP Tools for Nexys Bridge
 *
 * Exposes MCP tools for interacting with Python-based agent frameworks
 * connected via the Nexys Bridge. Follows the pattern from AgentTools.
 */

import type { FrameworkManager, FrameworkRuntime } from './framework-manager.js';

// ============================================================================
// MCP Types (matching Ruflo's shared types)
// ============================================================================

export interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface MCPToolResult {
  success: boolean;
  error?: string;
  [key: string]: unknown;
}

// ============================================================================
// Tool Definitions
// ============================================================================

const NEXYS_BRIDGE_TOOL_DEFS: MCPTool[] = [
  {
    name: 'nexys_bridge_list',
    description:
      'List all connected Nexys agent frameworks (NecroSwarm, NeuroSwarm, VoidTether, Capital-Sentience) ' +
      'with their capabilities, health status, and available methods.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'nexys_bridge_call',
    description:
      'Forward a method call to a specific Nexys framework via JSON-RPC. ' +
      'Returns the framework\'s response.',
    parameters: {
      type: 'object',
      properties: {
        frameworkId: {
          type: 'string',
          description: 'Framework identifier (e.g., "necroswarm", "voidtether")',
        },
        method: {
          type: 'string',
          description: 'JSON-RPC method to invoke on the framework',
        },
        params: {
          type: 'object',
          description: 'Parameters to pass to the method (optional)',
        },
      },
      required: ['frameworkId', 'method'],
    },
  },
  {
    name: 'nexys_bridge_status',
    description:
      'Check health status of all connected Nexys frameworks. Returns per-framework ' +
      'health information including whether each framework is reachable.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
];

// ============================================================================
// MCP Tool Provider
// ============================================================================

export interface MCPToolProvider {
  execute(toolName: string, params: Record<string, unknown>): Promise<MCPToolResult>;
  getTools(): MCPTool[];
}

/**
 * Create MCP tool provider for Nexys Bridge tools.
 * Follows the same pattern as AgentTools in the main repo.
 */
export function createNexysBridgeTools(frameworkManager: FrameworkManager): MCPToolProvider {
  return {
    getTools(): MCPTool[] {
      return NEXYS_BRIDGE_TOOL_DEFS;
    },

    async execute(toolName: string, params: Record<string, unknown>): Promise<MCPToolResult> {
      try {
        switch (toolName) {
          case 'nexys_bridge_list':
            return await handleListFrameworks(frameworkManager);

          case 'nexys_bridge_call':
            return await handleCallFramework(frameworkManager, params);

          case 'nexys_bridge_status':
            return await handleStatus(frameworkManager);

          default:
            return { success: false, error: `Unknown Nexys bridge tool: ${toolName}` };
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

// ============================================================================
// Tool Handlers
// ============================================================================

async function handleListFrameworks(mgr: FrameworkManager): Promise<MCPToolResult> {
  const frameworks = mgr.listFrameworks().map((fw: FrameworkRuntime) => ({
    name: fw.name,
    healthy: fw.healthy,
    restartCount: fw.restartCount,
    lastError: fw.lastError ?? null,
    version: fw.discovery?.version ?? 'unknown',
    capabilities: fw.discovery?.capabilities ?? [],
    methods: fw.discovery?.methods ?? [],
    connected: fw.client.connected,
  }));

  return {
    success: true,
    count: frameworks.length,
    frameworks,
  };
}

async function handleCallFramework(
  mgr: FrameworkManager,
  params: Record<string, unknown>,
): Promise<MCPToolResult> {
  const frameworkId = params.frameworkId as string;
  const method = params.method as string;
  const methodParams = params.params as Record<string, unknown> | undefined;

  if (!frameworkId || !method) {
    return {
      success: false,
      error: 'Both "frameworkId" and "method" are required parameters',
    };
  }

  // Validate frameworkId is a known framework
  const fw = mgr.getFramework(frameworkId);
  if (!fw) {
    const available = mgr.listFrameworks().map(f => f.name);
    return {
      success: false,
      error: `Unknown framework "${frameworkId}". Available: ${available.join(', ') || 'none'}`,
      availableFrameworks: available,
    };
  }

  const result = await mgr.forwardCall(frameworkId, method, methodParams);
  return {
    success: true,
    frameworkId,
    method,
    result,
  };
}

async function handleStatus(mgr: FrameworkManager): Promise<MCPToolResult> {
  const healthResults = await mgr.healthCheckAll();
  const results: Record<string, unknown>[] = [];

  for (const [name, status] of healthResults) {
    results.push({
      name,
      healthy: status.healthy,
      status: status.status,
      error: status.error ?? null,
    });
  }

  const allHealthy = results.every((r) => r.healthy === true);

  return {
    success: allHealthy,
    totalFrameworks: results.length,
    healthyCount: results.filter((r) => r.healthy === true).length,
    unhealthyCount: results.filter((r) => r.healthy === false).length,
    results,
  };
}

// ============================================================================
// Exports
// ============================================================================

export { NEXYS_BRIDGE_TOOL_DEFS };
export default createNexysBridgeTools;
