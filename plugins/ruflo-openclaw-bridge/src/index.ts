/**
 * OpenClaw ↔ RuFlo Bridge Plugin
 * 
 * Maps OpenClaw runtime operations to ruflo orchestration commands:
 * - sessions_spawn → ruflo agent spawn
 * - sessions_list → ruflo agent list
 * - sessions_send → ruflo agent message
 * - sessions_yield → ruflo agent await
 * - subagents list/steer/kill → ruflo swarm management
 * 
 * Also bridges OpenClaw memory system to ruflo-obliviarch compression.
 */

import { RufloPlugin, PluginContext } from 'ruflo';
import { WebSocket } from 'ws';

export interface OpenClawSession {
  sessionKey: string;
  label?: string;
  agentId?: string;
  status: 'active' | 'idle' | 'completed' | 'error';
  spawnTime: Date;
  lastActivity: Date;
  rufloAgentId?: string;
}

export interface BridgeConfig {
  openclawGateway: string;      // OpenClaw gateway URL
  openclawToken: string;         // Gateway auth token
  autoSyncMemory: boolean;       // Sync MEMORY.md to ruflo-obliviarch
  defaultSwarm: string;          // Default swarm for spawned agents
  maxConcurrentAgents: number;   // Limit parallel agents
}

export class OpenClawBridge implements RufloPlugin {
  id = 'openclaw-bridge';
  name = 'OpenClaw Bridge';
  version = '1.0.0';
  
  private context?: PluginContext;
  private config: BridgeConfig;
  private sessions: Map<string, OpenClawSession> = new Map();
  private ws?: WebSocket;

  constructor(config: Partial<BridgeConfig> = {}) {
    this.config = {
      openclawGateway: config.openclawGateway || 'ws://localhost:8080',
      openclawToken: config.openclawToken || '',
      autoSyncMemory: config.autoSyncMemory !== false,
      defaultSwarm: config.defaultSwarm || 'default',
      maxConcurrentAgents: config.maxConcurrentAgents || 10
    };
  }

  async initialize(context: PluginContext): Promise<void> {
    this.context = context;
    
    // Connect to OpenClaw gateway
    await this.connectGateway();
    
    // Start session sync loop
    this.startSessionSync();
    
    context.log.info('OpenClaw Bridge: Connected to gateway');
  }

  /**
   * Establish WebSocket connection to OpenClaw gateway
   */
  private async connectGateway(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.config.openclawGateway, {
        headers: {
          'Authorization': `Bearer ${this.config.openclawToken}`
        }
      });

      this.ws.on('open', () => {
        this.context?.log.info('WebSocket connected to OpenClaw');
        resolve();
      });

      this.ws.on('message', (data) => {
        this.handleGatewayMessage(JSON.parse(data.toString()));
      });

      this.ws.on('error', (err) => {
        this.context?.log.error(`WebSocket error: ${err.message}`);
        reject(err);
      });

      this.ws.on('close', () => {
        this.context?.log.warn('WebSocket closed, reconnecting...');
        setTimeout(() => this.connectGateway(), 5000);
      });
    });
  }

  /**
   * Handle messages from OpenClaw gateway
   */
  private handleGatewayMessage(msg: any): void {
    switch (msg.type) {
      case 'session.spawned':
        this.handleSessionSpawned(msg.data);
        break;
      case 'session.completed':
        this.handleSessionCompleted(msg.data);
        break;
      case 'session.error':
        this.handleSessionError(msg.data);
        break;
      case 'heartbeat':
        this.handleHeartbeat(msg.data);
        break;
    }
  }

  private handleSessionSpawned(data: any): void {
    const session: OpenClawSession = {
      sessionKey: data.sessionKey,
      label: data.label,
      agentId: data.agentId,
      status: 'active',
      spawnTime: new Date(data.timestamp),
      lastActivity: new Date()
    };
    
    this.sessions.set(session.sessionKey, session);
    
    // Map to ruflo agent
    this.mapToRufloAgent(session);
    
    this.context?.log.info(`Session spawned: ${session.sessionKey}`);
  }

  private handleSessionCompleted(data: any): void {
    const session = this.sessions.get(data.sessionKey);
    if (session) {
      session.status = 'completed';
      session.lastActivity = new Date();
      
      // Sync memory if enabled
      if (this.config.autoSyncMemory) {
        this.syncSessionMemory(session);
      }
      
      this.context?.log.info(`Session completed: ${session.sessionKey}`);
    }
  }

  private handleSessionError(data: any): void {
    const session = this.sessions.get(data.sessionKey);
    if (session) {
      session.status = 'error';
      session.lastActivity = new Date();
      this.context?.log.error(`Session error: ${session.sessionKey} - ${data.error}`);
    }
  }

  private handleHeartbeat(data: any): void {
    // Update last activity for all active sessions
    for (const session of this.sessions.values()) {
      if (session.status === 'active') {
        session.lastActivity = new Date();
      }
    }
  }

  /**
   * Map OpenClaw session to ruflo agent
   */
  private async mapToRufloAgent(session: OpenClawSession): Promise<void> {
    // Register with ruflo swarm as agent
    const rufloAgentId = `openclaw-${session.sessionKey}`;
    session.rufloAgentId = rufloAgentId;
    
    // Notify ruflo swarm system
    this.context?.events.emit('agent.registered', {
      agentId: rufloAgentId,
      source: 'openclaw',
      capabilities: ['openclaw-runtime', 'sessions', 'subagents'],
      metadata: {
        sessionKey: session.sessionKey,
        label: session.label,
        agentId: session.agentId
      }
    });
  }

  /**
   * Sync session memory to ruflo-obliviarch
   */
  private async syncSessionMemory(session: OpenClawSession): Promise<void> {
    try {
      // Fetch session transcript from OpenClaw
      const transcript = await this.fetchSessionTranscript(session.sessionKey);
      
      // Compress with Obliviarch
      this.context?.events.emit('memory.compress', {
        agentId: session.rufloAgentId,
        data: transcript,
        source: 'openclaw-session'
      });
      
      this.context?.log.info(`Memory synced for ${session.sessionKey}`);
    } catch (error) {
      this.context?.log.error(`Memory sync failed: ${error}`);
    }
  }

  private async fetchSessionTranscript(sessionKey: string): Promise<string> {
    // Call OpenClaw API to fetch session history
    const response = await fetch(
      `${this.config.openclawGateway.replace('ws', 'http')}/api/sessions/${sessionKey}/history`,
      {
        headers: {
          'Authorization': `Bearer ${this.config.openclawToken}`
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch transcript: ${response.statusText}`);
    }
    
    return response.text();
  }

  /**
   * Periodic session sync with OpenClaw
   */
  private startSessionSync(): void {
    setInterval(() => {
      this.syncActiveSessions();
    }, 30000); // Every 30 seconds
  }

  private async syncActiveSessions(): Promise<void> {
    try {
      const response = await fetch(
        `${this.config.openclawGateway.replace('ws', 'http')}/api/sessions`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.openclawToken}`
          }
        }
      );
      
      if (!response.ok) return;
      
      const sessions = await response.json();
      
      // Update local session map
      for (const sessionData of sessions) {
        const existing = this.sessions.get(sessionData.sessionKey);
        if (existing) {
          existing.status = sessionData.status;
          existing.lastActivity = new Date(sessionData.lastActivity);
        } else {
          // New session discovered
          this.handleSessionSpawned(sessionData);
        }
      }
    } catch (error) {
      this.context?.log.error(`Session sync failed: ${error}`);
    }
  }

  /**
   * Command handlers
   */
  async handleCommand(command: string, args: string[]): Promise<any> {
    switch (command) {
      case 'openclaw-spawn':
        return this.spawnAgent(args);
      case 'openclaw-list':
        return this.listAgents();
      case 'openclaw-send':
        return this.sendMessage(args);
      case 'openclaw-kill':
        return this.killAgent(args);
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }

  /**
   * Spawn agent: OpenClaw sessions_spawn → ruflo agent
   */
  private async spawnAgent(args: string[]): Promise<any> {
    const task = args[0] || 'default-task';
    const label = args[1] || `agent-${Date.now()}`;
    
    // Check capacity
    const activeCount = Array.from(this.sessions.values())
      .filter(s => s.status === 'active').length;
    
    if (activeCount >= this.config.maxConcurrentAgents) {
      throw new Error(`Max agents reached: ${this.config.maxConcurrentAgents}`);
    }
    
    // Spawn via OpenClaw API
    const response = await fetch(
      `${this.config.openclawGateway.replace('ws', 'http')}/api/sessions/spawn`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.openclawToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          task,
          label,
          runtime: 'subagent',
          timeout: 300
        })
      }
    );
    
    if (!response.ok) {
      throw new Error(`Spawn failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    return {
      sessionKey: result.sessionKey,
      label,
      task,
      status: 'spawned',
      mappedTo: `openclaw-${result.sessionKey}`
    };
  }

  /**
   * List agents: ruflo agent list ← OpenClaw sessions
   */
  private async listAgents(): Promise<any> {
    const agents = Array.from(this.sessions.values()).map(s => ({
      sessionKey: s.sessionKey,
      label: s.label,
      status: s.status,
      rufloAgentId: s.rufloAgentId,
      spawnTime: s.spawnTime,
      lastActivity: s.lastActivity,
      agentId: s.agentId
    }));
    
    return {
      total: agents.length,
      active: agents.filter(a => a.status === 'active').length,
      agents
    };
  }

  /**
   * Send message: ruflo agent message → OpenClaw sessions_send
   */
  private async sendMessage(args: string[]): Promise<any> {
    const sessionKey = args[0];
    const message = args.slice(1).join(' ');
    
    if (!sessionKey || !message) {
      throw new Error('Usage: openclaw-send <sessionKey> <message>');
    }
    
    const response = await fetch(
      `${this.config.openclawGateway.replace('ws', 'http')}/api/sessions/${sessionKey}/send`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.openclawToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message })
      }
    );
    
    if (!response.ok) {
      throw new Error(`Send failed: ${response.statusText}`);
    }
    
    return {
      sessionKey,
      sent: true,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Kill agent: ruflo agent kill → OpenClaw session terminate
   */
  private async killAgent(args: string[]): Promise<any> {
    const sessionKey = args[0];
    
    if (!sessionKey) {
      throw new Error('Usage: openclaw-kill <sessionKey>');
    }
    
    const response = await fetch(
      `${this.config.openclawGateway.replace('ws', 'http')}/api/sessions/${sessionKey}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.config.openclawToken}`
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Kill failed: ${response.statusText}`);
    }
    
    // Update local state
    const session = this.sessions.get(sessionKey);
    if (session) {
      session.status = 'completed';
      session.lastActivity = new Date();
    }
    
    return {
      sessionKey,
      killed: true,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get session by key
   */
  getSession(sessionKey: string): OpenClawSession | undefined {
    return this.sessions.get(sessionKey);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): OpenClawSession[] {
    return Array.from(this.sessions.values())
      .filter(s => s.status === 'active');
  }
}

export default OpenClawBridge;
