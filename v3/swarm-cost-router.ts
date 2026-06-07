/**
 * CostRouter v3 Integration for RuFlo Swarm
 * 
 * Integrates capability-based model routing with RuFlo's agent orchestration.
 * Each swarm agent gets routed to the optimal LLM based on its task category
 * and required capabilities.
 */

import { CapabilityRouter, TaskRequest, RouteResult } from '../cost-router-v3/cost_router_v3';
import { V3SwarmConfig } from './swarm.config';

// =============================================================================
// CostRouter v3 Integration
// =============================================================================

export interface CostRouterConfig {
  enabled: boolean;
  configPath: string;  // Path to tier0-ultra.json
  defaultTier: string;  // Fallback tier
  agentRouting: Record<string, AgentRouteConfig>;  // Per-agent routing rules
}

export interface AgentRouteConfig {
  taskCategories: string[];
  requiredCapabilities: string[];
  complexityTier: string;
  preferredTier?: string;  // Override tier for specific agents
}

// =============================================================================
// Default Agent Routing Configuration
// =============================================================================

export const defaultAgentRouting: Record<string, AgentRouteConfig> = {
  // Queen Coordinator - needs broad capabilities
  'agent-1': {
    taskCategories: ['orchestration', 'strategy'],
    requiredCapabilities: ['reasoning', 'tool_use', 'long_context'],
    complexityTier: 'expert',
    preferredTier: 'T0'  // Always use best model for queen
  },
  
  // Security agents - need reasoning + tool use
  'agent-2': {
    taskCategories: ['architecture', 'analysis'],
    requiredCapabilities: ['reasoning', 'tool_use'],
    complexityTier: 'complex'
  },
  'agent-3': {
    taskCategories: ['code_generation', 'debugging'],
    requiredCapabilities: ['code_execution', 'tool_use'],
    complexityTier: 'complex'
  },
  'agent-4': {
    taskCategories: ['debugging', 'analysis'],
    requiredCapabilities: ['code_execution', 'reasoning'],
    complexityTier: 'complex'
  },
  
  // Core agents - need coding + architecture
  'agent-5': {
    taskCategories: ['architecture', 'strategy'],
    requiredCapabilities: ['reasoning', 'long_context'],
    complexityTier: 'expert',
    preferredTier: 'T0'
  },
  'agent-6': {
    taskCategories: ['code_generation', 'implementation'],
    requiredCapabilities: ['code_execution', 'tool_use'],
    complexityTier: 'complex'
  },
  'agent-7': {
    taskCategories: ['architecture', 'implementation'],
    requiredCapabilities: ['reasoning', 'tool_use', 'long_context'],
    complexityTier: 'complex'
  },
  'agent-8': {
    taskCategories: ['orchestration', 'architecture'],
    requiredCapabilities: ['agent_swarm', 'reasoning', 'tool_use'],
    complexityTier: 'expert',
    preferredTier: 'T0'
  },
  'agent-9': {
    taskCategories: ['orchestration', 'implementation'],
    requiredCapabilities: ['tool_use', 'function_calling'],
    complexityTier: 'moderate'
  },
  
  // Integration agents
  'agent-10': {
    taskCategories: ['architecture', 'implementation'],
    requiredCapabilities: ['reasoning', 'tool_use'],
    complexityTier: 'complex'
  },
  'agent-11': {
    taskCategories: ['code_generation', 'implementation'],
    requiredCapabilities: ['code_execution', 'tool_use'],
    complexityTier: 'moderate'
  },
  'agent-12': {
    taskCategories: ['implementation', 'research'],
    requiredCapabilities: ['reasoning', 'tool_use'],
    complexityTier: 'complex'
  },
  
  // Quality agents - need reasoning but less coding
  'agent-13': {
    taskCategories: ['review', 'analysis'],
    requiredCapabilities: ['reasoning', 'code_execution'],
    complexityTier: 'complex'
  },
  
  // Performance agents
  'agent-14': {
    taskCategories: ['analysis', 'research'],
    requiredCapabilities: ['reasoning'],
    complexityTier: 'moderate'
  },
  
  // Release agents
  'agent-15': {
    taskCategories: ['orchestration', 'implementation'],
    requiredCapabilities: ['tool_use'],
    complexityTier: 'moderate'
  }
};

// =============================================================================
// Swarm + CostRouter Integration
// =============================================================================

export class SwarmCostRouter {
  private router: CapabilityRouter;
  private agentRouting: Record<string, AgentRouteConfig>;
  
  constructor(config: CostRouterConfig) {
    this.router = CapabilityRouter.from_config(config.configPath);
    this.agentRouting = config.agentRouting || defaultAgentRouting;
  }
  
  /**
   * Route a swarm agent's task to the optimal model
   */
  routeAgentTask(agentId: string, taskDescription: string): RouteResult {
    const agentConfig = this.agentRouting[agentId];
    if (!agentConfig) {
      // Default routing for unknown agents
      return this.router.route({
        task_category: 'orchestration',
        required_capabilities: ['tool_use'],
        complexity_tier: 'moderate',
        content: taskDescription,
        agent_source: agentId
      });
    }
    
    // Use agent's preferred tier if specified
    if (agentConfig.preferredTier) {
      return this.router.route({
        task_category: agentConfig.taskCategories[0],
        required_capabilities: agentConfig.requiredCapabilities,
        complexity_tier: agentConfig.complexityTier,
        content: taskDescription,
        agent_source: agentId,
        // Override tier if preferred
        ...(agentConfig.preferredTier && {
          // This would need modification to the router to accept tier hints
          // For now, we trust the router's decision
        })
      });
    }
    
    return this.router.route({
      task_category: agentConfig.taskCategories[0],
      required_capabilities: agentConfig.requiredCapabilities,
      complexity_tier: agentConfig.complexityTier,
      content: taskDescription,
      agent_source: agentId
    });
  }
  
  /**
   * Get model assignments for all agents in a swarm phase
   */
  getPhaseModelAssignments(phaseId: string, activeAgents: string[]): Map<string, RouteResult> {
    const assignments = new Map<string, RouteResult>();
    
    for (const agentId of activeAgents) {
      const assignment = this.routeAgentTask(
        agentId,
        `Phase ${phaseId} execution for ${agentId}`
      );
      assignments.set(agentId, assignment);
    }
    
    return assignments;
  }
  
  /**
   * Get cost estimate for a swarm phase
   */
  estimatePhaseCost(phaseId: string, activeAgents: string[], estimatedTasksPerAgent: number): {
    estimatedCost: number;
    tierBreakdown: Record<string, number>;
  } {
    const assignments = this.getPhaseModelAssignments(phaseId, activeAgents);
    
    let totalCost = 0;
    const tierBreakdown: Record<string, number> = {};
    
    for (const [agentId, route] of assignments) {
      const tier = this.router.config.tiers[route.tier];
      if (tier?.cost_profile) {
        const costPerTask = 
          (tier.cost_profile.input_cost_per_1k_tokens * 10) +  // Assume 10K input
          (tier.cost_profile.output_cost_per_1k_tokens * 5);    // Assume 5K output
        
        const agentCost = costPerTask * estimatedTasksPerAgent;
        totalCost += agentCost;
        
        tierBreakdown[route.tier] = (tierBreakdown[route.tier] || 0) + agentCost;
      }
    }
    
    return { estimatedCost: totalCost, tierBreakdown };
  }
}

// =============================================================================
// Updated Swarm Config with CostRouter v3
// =============================================================================

export const defaultCostRouterConfig: CostRouterConfig = {
  enabled: true,
  configPath: './cost-router-v2/config/examples/tier0-ultra.json',
  defaultTier: 'T2',
  agentRouting: defaultAgentRouting
};

// Extend V3SwarmConfig to include CostRouter
export interface V3SwarmConfigWithCostRouter extends V3SwarmConfig {
  costRouter: CostRouterConfig;
}

// =============================================================================
// Usage Example
// =============================================================================

/*
import { SwarmCostRouter } from './swarm-cost-router';

const swarmRouter = new SwarmCostRouter({
  enabled: true,
  configPath: './cost-router-v2/config/examples/tier0-ultra.json',
  defaultTier: 'T2',
  agentRouting: defaultAgentRouting
});

// Route queen's task
const queenRoute = swarmRouter.routeAgentTask(
  'agent-1',
  'Coordinate the swarm for Phase 3 integration'
);
console.log(`Queen uses ${queenRoute.model_id} (${queenRoute.tier})`);

// Get phase assignments
const phase3Agents = ['agent-1', 'agent-10', 'agent-11', 'agent-12'];
const assignments = swarmRouter.getPhaseModelAssignments('phase-3', phase3Agents);

// Estimate cost
const cost = swarmRouter.estimatePhaseCost('phase-3', phase3Agents, 100);
console.log(`Phase 3 estimated cost: $${cost.estimatedCost.toFixed(2)}`);
*/
