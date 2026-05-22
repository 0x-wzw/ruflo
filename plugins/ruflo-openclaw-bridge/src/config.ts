/**
 * OpenClaw ↔ RuFlo Bridge Configuration
 * 
 * Environment-specific settings for connecting OpenClaw runtime to ruflo.
 * Update this file with your OpenClaw gateway URL and credentials.
 */

export interface BridgeEnvironment {
  // OpenClaw Gateway
  gatewayUrl: string;        // WebSocket URL for OpenClaw gateway
  httpUrl: string;          // HTTP API URL for OpenClaw
  token: string;            // Authentication token
  
  // RuFlo Settings
  defaultSwarm: string;     // Default swarm name for spawned agents
  maxConcurrentAgents: number;  // Limit parallel sessions
  
  // Memory Sync
  autoSyncMemory: boolean;  // Compress session memory to Obliviarch
  syncInterval: number;     // Sync interval in ms (default: 30000)
  
  // Features
  enableHeartbeat: boolean;  // Sync session status periodically
  enableAutoMapping: boolean; // Auto-map new sessions to ruflo agents
}

export const defaultConfig: BridgeEnvironment = {
  gatewayUrl: process.env.OPENCLAW_WS_URL || 'ws://localhost:8080',
  httpUrl: process.env.OPENCLAW_HTTP_URL || 'http://localhost:8080',
  token: process.env.OPENCLAW_TOKEN || '',
  
  defaultSwarm: process.env.RUFLO_DEFAULT_SWARM || 'default',
  maxConcurrentAgents: parseInt(process.env.RUFLO_MAX_AGENTS || '10', 10),
  
  autoSyncMemory: process.env.OPENCLAW_SYNC_MEMORY !== 'false',
  syncInterval: parseInt(process.env.OPENCLAW_SYNC_INTERVAL || '30000', 10),
  
  enableHeartbeat: process.env.OPENCLAW_HEARTBEAT !== 'false',
  enableAutoMapping: process.env.OPENCLAW_AUTO_MAP !== 'false'
};

export function loadConfig(): BridgeEnvironment {
  return {
    ...defaultConfig,
    // Override with any runtime config if needed
  };
}
