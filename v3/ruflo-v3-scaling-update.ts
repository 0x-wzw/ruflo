/**
 * RuFlo v3 Update: Scaling to 300 Agents with CostRouter Integration
 * 
 * This update modifies the existing v3 swarm configuration to support
 * 300 agents using adaptive federation and capability-based model routing.
 */

import { V3SwarmConfig } from './swarm.config';
import { CostRouterConfig, defaultCostRouterConfig } from './swarm-cost-router';

// =============================================================================
// Updated v3 Configuration for 300 Agents
// =============================================================================

export const v3ScalingConfig: Partial<V3SwarmConfig> = {
  // Scale settings
  maxAgents: 300,
  
  // Topology: Adaptive Federation for cross-machine scaling
  topology: 'adaptive-federation',
  subTopology: 'hierarchical-mesh',
  
  // Federation settings (new)
  federation: {
    enabled: true,
    nodes: [
      {
        id: 'node-1',
        region: 'ap-southeast-1',
        maxAgents: 100,
        roles: ['security', 'core']
      },
      {
        id: 'node-2',
        region: 'ap-southeast-2',
        maxAgents: 100,
        roles: ['core', 'integration']
      },
      {
        id: 'node-3',
        region: 'ap-northeast-1',
        maxAgents: 100,
        roles: ['quality', 'performance', 'deployment']
      }
    ],
    discovery: 'dns-srv',
    auth: 'mTLS',
    healthCheckInterval: 30000,
    failoverTimeout: 60000
  },
  
  // Consensus: Hybrid (Raft for strong consistency, Gossip for weak)
  consensus: {
    protocol: 'hybrid',
    raft: {
      domains: ['security', 'core'],
      electionTimeout: 1000,
      heartbeatInterval: 100
    },
    gossip: {
      domains: ['integration', 'quality', 'performance'],
      rounds: 3,
      fanout: 4
    }
  },
  
  // Persistence: Distributed (new)
  persistence: {
    mode: 'distributed',
    backend: 'redis-cluster',
    checkpointInterval: 30000,
    restoreOnFailure: true,
    memoryTiering: {
      l1_hot: { maxAgents: 50, storage: 'memory' },
      l2_warm: { maxAgents: 100, storage: 'ssd' },
      l3_cold: { maxAgents: 150, storage: 's3' }
    }
  },
  
  // Load balancing: Capability-based (updated)
  loadBalancingStrategy: 'capability-match',
  
  // Performance targets (updated for 300 agents)
  performance: {
    maxLatencyMs: 500,          // Up from 200ms (acceptable for 300 agents)
    targetThroughputTps: 500,   // Up from 100 TPS
    maxMemoryMb: 65536,         // 64GB for 300 agents
    minAvailability: 0.995      // 99.5% (up from 99%)
  },
  
  // Message timeout increased for distributed setup
  messageTimeout: 60000,        // Up from 30000ms
  
  // Health check interval
  healthCheckInterval: 10000,   // Up from 5000ms
  
  // Retry attempts
  retryAttempts: 5              // Up from 3
};

// =============================================================================
// Domain Configuration for 300 Agents
// =============================================================================

export const v3DomainConfig = [
  {
    domain: 'security',
    agents: Array.from({ length: 60 }, (_, i) => `security-${String(i + 1).padStart(3, '0')}`),
    priority: 1,
    parallelExecution: true,
    consensusProtocol: 'raft'
  },
  {
    domain: 'core',
    agents: Array.from({ length: 90 }, (_, i) => `core-${String(i + 1).padStart(3, '0')}`),
    priority: 2,
    parallelExecution: true,
    consensusProtocol: 'raft'
  },
  {
    domain: 'integration',
    agents: Array.from({ length: 60 }, (_, i) => `integration-${String(i + 1).padStart(3, '0')}`),
    priority: 3,
    parallelExecution: true,
    consensusProtocol: 'gossip'
  },
  {
    domain: 'quality',
    agents: Array.from({ length: 30 }, (_, i) => `quality-${String(i + 1).padStart(3, '0')}`),
    priority: 2,
    parallelExecution: false,
    consensusProtocol: 'gossip'
  },
  {
    domain: 'performance',
    agents: Array.from({ length: 30 }, (_, i) => `performance-${String(i + 1).padStart(3, '0')}`),
    priority: 4,
    parallelExecution: false,
    consensusProtocol: 'gossip'
  },
  {
    domain: 'deployment',
    agents: Array.from({ length: 30 }, (_, i) => `deployment-${String(i + 1).padStart(3, '0')}`),
    priority: 5,
    parallelExecution: false,
    consensusProtocol: 'gossip'
  }
];

// =============================================================================
// CostRouter Integration Config
// =============================================================================

export const v3CostRouterConfig: CostRouterConfig = {
  ...defaultCostRouterConfig,
  
  // Update agent routing for 300 agents
  agentRouting: {
    // Queen coordinators (one per node)
    'node-1-queen': {
      taskCategories: ['orchestration', 'strategy'],
      requiredCapabilities: ['reasoning', 'tool_use', 'long_context'],
      complexityTier: 'expert',
      preferredTier: 'T0'
    },
    'node-2-queen': {
      taskCategories: ['orchestration', 'strategy'],
      requiredCapabilities: ['reasoning', 'tool_use', 'long_context'],
      complexityTier: 'expert',
      preferredTier: 'T0'
    },
    'node-3-queen': {
      taskCategories: ['orchestration', 'strategy'],
      requiredCapabilities: ['reasoning', 'tool_use', 'long_context'],
      complexityTier: 'expert',
      preferredTier: 'T0'
    },
    
    // Sub-queens per domain
    'security-lead': {
      taskCategories: ['architecture', 'analysis'],
      requiredCapabilities: ['reasoning', 'tool_use'],
      complexityTier: 'expert',
      preferredTier: 'T0'
    },
    'core-lead': {
      taskCategories: ['architecture', 'strategy'],
      requiredCapabilities: ['reasoning', 'long_context'],
      complexityTier: 'expert',
      preferredTier: 'T0'
    },
    'integration-lead': {
      taskCategories: ['architecture', 'implementation'],
      requiredCapabilities: ['reasoning', 'tool_use'],
      complexityTier: 'complex'
    },
    
    // Worker agents (use default routing)
    'worker-default': {
      taskCategories: ['implementation', 'analysis'],
      requiredCapabilities: ['tool_use'],
      complexityTier: 'moderate'
    }
  }
};

// =============================================================================
// Infrastructure Requirements
// =============================================================================

export const v3InfrastructureRequirements = {
  compute: {
    nodes: 3,
    instanceType: 'c6i.8xlarge',  // 32 vCPU, 64GB RAM each
    totalVcpu: 96,
    totalMemoryGb: 192
  },
  network: {
    bandwidthGbps: 10,
    latencyMs: 5,
    topology: 'vpc-peering'
  },
  storage: {
    type: 'nvme',
    sizeGb: 500,
    iops: 10000
  },
  memory: {
    backend: 'redis-cluster',
    nodes: 6,
    instanceType: 'cache.r6g.xlarge'
  },
  persistence: {
    checkpointInterval: 30000,
    storageBackend: 's3',
    compression: true
  }
};

// =============================================================================
// Migration Path from v2 → v3
// =============================================================================

/*
Step 1: Update swarm.config.ts
- Change maxAgents from 15 to 300
- Change topology to 'adaptive-federation'
- Add federation config

Step 2: Add swarm-cost-router.ts
- Import CapabilityRouter from cost_router_v3.py
- Configure per-agent routing rules

Step 3: Update agent lifecycle
- Add checkpoint/restore hooks
- Implement graceful shutdown for distributed agents

Step 4: Deploy infrastructure
- Provision 3 EC2 instances (c6i.8xlarge)
- Setup Redis cluster (6 nodes)
- Configure VPC peering
- Deploy mTLS certificates

Step 5: Run benchmark
- Use swarm_benchmark.py to validate scaling
- Target: 300 agents, 500 TPS, <500ms latency
*/

// =============================================================================
// Cost Projections
// =============================================================================

export const v3CostProjections = {
  monthly: {
    compute: 1200,      // 3x c6i.8xlarge
    memory: 300,        // Redis cluster
    storage: 150,       // NVMe + S3
    network: 200,       // Data transfer
    total: 1850
  },
  perAgent: {
    monthly: 6.17,      // $1850 / 300 agents
    hourly: 0.008       // $6.17 / 730 hours
  }
};

export default {
  scalingConfig: v3ScalingConfig,
  domainConfig: v3DomainConfig,
  costRouterConfig: v3CostRouterConfig,
  infrastructureRequirements: v3InfrastructureRequirements,
  costProjections: v3CostProjections
};
