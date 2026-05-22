/**
 * Nexys Agent Registration
 *
 * Registers each discovered Python framework as a specialized agent type
 * in Ruflo's agent registry. Agent types follow the pattern: nexys:<framework-name>
 * (e.g., nexys-necroswarm, nexys-voidtether).
 */

import type { FrameworkManager, FrameworkRuntime } from './framework-manager.js';

// ============================================================================
// Agent Type Definition
// ============================================================================

/**
 * Agent type definition compatible with Ruflo's AgentTypeDefinition.
 * Using a self-contained interface to avoid depending on shared package types.
 */
export interface NexysAgentTypeDefinition {
  type: string;
  name: string;
  description: string;
  defaultConfig: {
    type: string;
    capabilities: string[];
    metadata: Record<string, unknown>;
  };
  requiredCapabilities?: string[];
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Plugin Context Agent Registry (minimal interface)
// ============================================================================

export interface NexysContextAgentRegistry {
  registerAgentType(type: NexysAgentTypeDefinition): void;
  getAgentTypes(): NexysAgentTypeDefinition[];
}

// ============================================================================
// Registration Logic
// ============================================================================

/** Framework name → display name mapping for user-friendly labels */
const FRAMEWORK_DISPLAY_NAMES: Record<string, string> = {
  necronecroswarm: 'NecroSwarm Agent',
  necroswarm: 'NecroSwarm Agent',
  neuroswarm: 'NeuroSwarm Agent',
  voidtether: 'VoidTether Agent',
  'capital-sentience': 'Capital-Sentience Agent',
};

function getDisplayName(frameworkName: string): string {
  return FRAMEWORK_DISPLAY_NAMES[frameworkName] ??
    `${frameworkName.charAt(0).toUpperCase() + frameworkName.slice(1)} Agent`;
}

function getAgentTypeId(frameworkName: string): string {
  return `nexys:${frameworkName.toLowerCase().replace(/\s+/g, '-')}`;
}

/**
 * Register all connected Nexys frameworks as Ruflo agent types.
 * Called during plugin initialization after frameworks are discovered.
 */
export function registerNexysAgents(
  agentRegistry: NexysContextAgentRegistry,
  frameworkManager: FrameworkManager,
): NexysAgentTypeDefinition[] {
  const registrations: NexysAgentTypeDefinition[] = [];
  const frameworks = frameworkManager.listFrameworks();

  for (const fw of frameworks) {
    const capabilities = fw.discovery?.capabilities ?? [];
    const methods = fw.discovery?.methods ?? [];
    const capabilityNames = capabilities.map((c) => c.name);

    const agentTypeDef: NexysAgentTypeDefinition = {
      type: getAgentTypeId(fw.name),
      name: getDisplayName(fw.name),
      description: `Nexys-bridged agent powered by ${fw.name} (v${fw.discovery?.version ?? 'unknown'}). ` +
        `Capabilities: ${capabilityNames.join(', ') || 'unknown'}. ` +
        `Available methods: ${methods.length}`,
      defaultConfig: {
        type: getAgentTypeId(fw.name),
        capabilities: capabilityNames,
        metadata: {
          nexysFramework: fw.name,
          nexysVersion: fw.discovery?.version ?? 'unknown',
          bridgeType: 'child-process-stdio',
          protocol: 'json-rpc-2.0',
        },
      },
      requiredCapabilities: capabilityNames,
      metadata: {
        framework: fw.name,
        version: fw.discovery?.version,
        methods,
        healthy: fw.healthy,
      },
    };

    try {
      agentRegistry.registerAgentType(agentTypeDef);
      registrations.push(agentTypeDef);
    } catch (err) {
      console.warn(
        `[nexys-bridge] Failed to register agent type for "${fw.name}": ` +
        `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return registrations;
}
