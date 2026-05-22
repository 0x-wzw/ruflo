/**
 * Nexys Bridge Protocol — JSON-RPC 2.0 over child process stdio
 *
 * Defines the wire protocol for communication between the Nexys Bridge
 * TypeScript plugin and Python-based agent frameworks (NecroSwarm,
 * NeuroSwarm, VoidTether, Capital-Sentience).
 */

// ============================================================================
// JSON-RPC 2.0 Core Types
// ============================================================================

/** JSON-RPC 2.0 request object */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: unknown[] | Record<string, unknown>;
  id: string | number;
}

/** JSON-RPC 2.0 success response */
export interface JsonRpcSuccessResponse {
  jsonrpc: '2.0';
  result: unknown;
  id: string | number;
}

/** JSON-RPC 2.0 error response */
export interface JsonRpcErrorResponse {
  jsonrpc: '2.0';
  error: JsonRpcErrorObject;
  id: string | number | null;
}

/** JSON-RPC 2.0 response (success or error) */
export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;

/** JSON-RPC 2.0 notification (no id, no response expected) */
export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown[] | Record<string, unknown>;
}

/** JSON-RPC 2.0 error object */
export interface JsonRpcErrorObject {
  code: number;
  message: string;
  data?: unknown;
}

// ============================================================================
// Framework-Specific Protocol Types
// ============================================================================

/** Capability descriptor returned by list_capabilities */
export interface FrameworkCapability {
  name: string;
  description: string;
  version?: string;
  methods?: string[];
}

/** Discovery result from list_capabilities RPC */
export interface FrameworkDiscovery {
  framework: string;
  version: string;
  capabilities: FrameworkCapability[];
  methods: string[];
}

/** Agent execution task sent to a Python framework */
export interface AgentExecutionTask {
  taskId: string;
  objective: string;
  context?: Record<string, unknown>;
  agentConfig?: {
    model?: string;
    maxSteps?: number;
    tools?: string[];
  };
}

/** Memory entry for store/search operations */
export interface FrameworkMemoryEntry {
  key: string;
  value: unknown;
  namespace?: string;
  metadata?: Record<string, unknown>;
  timestamp?: number;
}

/** Workflow resolution request */
export interface WorkflowResolutionRequest {
  workflowId: string;
  objective: string;
  context?: Record<string, unknown>;
  constraints?: Record<string, unknown>;
}

// ============================================================================
// Nexys Protocol Client — Wraps a child process
// ============================================================================

import { ChildProcess, spawn } from 'child_process';
import { createInterface, Interface } from 'readline';

/** Options for NexysProtocolClient */
export interface NexysProtocolClientOptions {
  serverPath: string;
  frameworkName: string;
  timeout?: number; // ms, default 30_000
  args?: string[];
}

/** Error thrown for protocol-level issues */
export class NexysProtocolError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = 'NexysProtocolError';
  }
}

export class NexysProtocolClient {
  public readonly frameworkName: string;
  private serverPath: string;
  private process: ChildProcess | null = null;
  private rl: Interface | null = null;
  private requestId = 0;
  private pending = new Map<string | number, {
    resolve: (value: unknown) => void;
    reject: (err: Error) => void;
    timer: NodeJS.Timeout;
  }>();
  private timeout: number;
  private args: string[];
  private buffer = '';

  constructor(options: NexysProtocolClientOptions) {
    this.serverPath = options.serverPath;
    this.frameworkName = options.frameworkName;
    this.timeout = options.timeout ?? 30_000;
    this.args = options.args ?? [];
  }

  /**
   * Connect to the Python JSON-RPC server via child process.
   * Supports:
   *   - .sh files → spawns via bash
   *   - .py files → spawns via python3 <file> --mode stdio
   *   - python3 -m <module> → spawns via python3 -m <module>
   * Sets up line-based stdin/stdout communication.
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const cmd: string = this.serverPath;
      let spawnCmd: string;
      let spawnArgs: string[];

      if (cmd.endsWith('.sh') || cmd.endsWith('.bash')) {
        spawnCmd = 'bash';
        spawnArgs = [cmd];
      } else if (cmd.startsWith('python3 -m ')) {
        // Interpret the whole string as python3 + args
        spawnCmd = 'python3';
        spawnArgs = [...cmd.slice('python3'.length).trim().split(/\s+/), '--mode', 'stdio', ...this.args];
      } else {
        spawnCmd = 'python3';
        spawnArgs = [cmd, '--mode', 'stdio', ...this.args];
      }

      this.process = spawn(spawnCmd, spawnArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd(),
      });

      this.process.on('error', (err) => {
        reject(new NexysProtocolError(
          `Failed to spawn framework "${this.frameworkName}": ${err.message}`,
        ));
      });

      this.process.on('exit', (code, signal) => {
        // Reject all pending requests
        for (const [, pending] of this.pending) {
          clearTimeout(pending.timer);
          pending.reject(new NexysProtocolError(
            `Framework "${this.frameworkName}" process exited with code ${code}, signal ${signal}`,
          ));
        }
        this.pending.clear();
        this.process = null;
        this.rl = null;
      });

      if (this.process.stderr) {
        this.process.stderr.on('data', (data: Buffer) => {
          // Log framework stderr as warnings (useful for debugging)
          console.warn(`[nexys:${this.frameworkName}:stderr] ${data.toString().trim()}`);
        });
      }

      if (!this.process.stdout) {
        reject(new NexysProtocolError(
          `No stdout on framework "${this.frameworkName}" process`,
        ));
        return;
      }

      this.rl = createInterface({ input: this.process.stdout });
      this.rl.on('line', (line: string) => {
        this.handleLine(line);
      });

      // Wait briefly for the process to be ready, then resolve
      setTimeout(() => resolve(), 200);
    });
  }

  /**
   * Send a JSON-RPC call and wait for response.
   */
  async call(method: string, params?: unknown[] | Record<string, unknown>): Promise<unknown> {
    if (!this.process || !this.process.stdin) {
      throw new NexysProtocolError(
        `Framework "${this.frameworkName}" is not connected`,
      );
    }

    const id = ++this.requestId;
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id,
    };

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new NexysProtocolError(
          `Request to "${this.frameworkName}" timed out after ${this.timeout}ms: ${method}`,
        ));
      }, this.timeout);

      this.pending.set(id, { resolve, reject, timer });

      try {
        this.process!.stdin!.write(JSON.stringify(request) + '\n');
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(new NexysProtocolError(
          `Failed to write to framework "${this.frameworkName}": ${err instanceof Error ? err.message : String(err)}`,
        ));
      }
    });
  }

  /**
   * Send a JSON-RPC notification (no response expected).
   */
  notify(method: string, params?: unknown[] | Record<string, unknown>): void {
    if (!this.process || !this.process.stdin) {
      console.warn(`[nexys:${this.frameworkName}] Cannot notify: not connected`);
      return;
    }

    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method,
      params,
    };

    this.process.stdin.write(JSON.stringify(notification) + '\n');
  }

  /**
   * Disconnect and kill the child process.
   */
  async disconnect(): Promise<void> {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }

    if (this.process) {
      // Reject all outstanding requests
      for (const [, pending] of this.pending) {
        clearTimeout(pending.timer);
        pending.reject(new NexysProtocolError(
          `Framework "${this.frameworkName}" was disconnected`,
        ));
      }
      this.pending.clear();

      this.process.kill('SIGTERM');

      // Give it a moment to exit gracefully, then SIGKILL
      await new Promise<void>((resolve) => {
        if (!this.process) { resolve(); return; }
        const killTimer = setTimeout(() => {
          if (this.process) {
            this.process.kill('SIGKILL');
          }
          resolve();
        }, 2000);

        this.process.once('exit', () => {
          clearTimeout(killTimer);
          resolve();
        });
      });

      this.process = null;
    }
  }

  /** Check if the client is connected */
  get connected(): boolean {
    return this.process !== null && !this.process.killed;
  }

  // ========================================================================
  // High-Level Framework Methods
  // ========================================================================

  /** Discover framework capabilities */
  async listCapabilities(): Promise<FrameworkDiscovery> {
    return this.call('list_capabilities') as Promise<FrameworkDiscovery>;
  }

  /** Execute an agent task */
  async agentExecute(task: AgentExecutionTask): Promise<unknown> {
    return this.call('agent.execute', { task });
  }

  /** Store a memory entry */
  async memoryStore(entry: FrameworkMemoryEntry): Promise<unknown> {
    return this.call('memory.store', { entry });
  }

  /** Search memory */
  async memorySearch(query: string, limit: number = 10): Promise<unknown> {
    return this.call('memory.search', { query, limit });
  }

  /** Resolve a workflow */
  async workflowResolve(objective: string, context?: Record<string, unknown>): Promise<unknown> {
    return this.call('workflow.resolve', { objective, context });
  }

  /** Health check */
  async healthCheck(): Promise<{ status: string; framework: string }> {
    return this.call('health.check') as Promise<{ status: string; framework: string }>;
  }

  // ========================================================================
  // Private Helpers
  // ========================================================================

  private handleLine(line: string): void {
    try {
      const response: JsonRpcResponse = JSON.parse(line);

      if ('id' in response && response.id !== null) {
        const pending = this.pending.get(response.id);
        if (!pending) {
          console.warn(`[nexys:${this.frameworkName}] Unexpected response for id ${response.id}`);
          return;
        }

        clearTimeout(pending.timer);
        this.pending.delete(response.id);

        if ('error' in response) {
          pending.reject(new NexysProtocolError(
            response.error.message,
            response.error.code,
            response.error.data,
          ));
        } else {
          pending.resolve(response.result);
        }
      }
      // Notifications/responses without pending handler are silently ignored
    } catch (err) {
      console.warn(`[nexys:${this.frameworkName}] Failed to parse response: ${line.slice(0, 200)}`);
    }
  }
}
