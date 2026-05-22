/**
 * Framework Manager
 *
 * Manages multiple Python subprocess connections to Nexys agent frameworks.
 * Each framework runs as a child process with JSON-RPC 2.0 over stdio.
 */

import {
  NexysProtocolClient,
  NexysProtocolError,
  type FrameworkDiscovery,
  type NexysProtocolClientOptions,
} from './protocol.js';

// ============================================================================
// Types
// ============================================================================

/** Configuration for a single Nexys framework */
export interface NexysFrameworkConfig {
  /** Unique framework name (e.g., "necroswarm") */
  name: string;
  /** Path to the Python JSON-RPC server script */
  serverPath: string;
  /** Additional CLI args for the Python process */
  args?: string[];
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Framework-specific config */
  config?: Record<string, unknown>;
}

/** Runtime state for a managed framework */
export interface FrameworkRuntime {
  name: string;
  client: NexysProtocolClient;
  discovery: FrameworkDiscovery | null;
  healthy: boolean;
  restartCount: number;
  lastError?: string;
}

/** Options for the FrameworkManager */
export interface FrameworkManagerOptions {
  maxRestarts?: number;
  restartDelayMs?: number;
}

// ============================================================================
// Framework Manager
// ============================================================================

export class FrameworkManager {
  private frameworks = new Map<string, FrameworkRuntime>();
  private maxRestarts: number;
  private restartDelayMs: number;

  constructor(options: FrameworkManagerOptions = {}) {
    this.maxRestarts = options.maxRestarts ?? 3;
    this.restartDelayMs = options.restartDelayMs ?? 1000;
  }

  /**
   * Add and connect to a Nexys framework.
   * Spawns the Python process, discovers capabilities, and marks as healthy.
   */
  async addFramework(cfg: NexysFrameworkConfig): Promise<FrameworkDiscovery> {
    if (this.frameworks.has(cfg.name)) {
      throw new NexysProtocolError(
        `Framework "${cfg.name}" is already registered. Remove it first.`,
      );
    }

    const client = new NexysProtocolClient({
      serverPath: cfg.serverPath,
      frameworkName: cfg.name,
      timeout: cfg.timeout,
      args: cfg.args,
    });

    const runtime: FrameworkRuntime = {
      name: cfg.name,
      client,
      discovery: null,
      healthy: false,
      restartCount: 0,
    };

    this.frameworks.set(cfg.name, runtime);

    try {
      await client.connect();
      const discovery = await client.listCapabilities();
      runtime.discovery = discovery;
      runtime.healthy = true;
      return discovery;
    } catch (err) {
      runtime.healthy = false;
      runtime.lastError = err instanceof Error ? err.message : String(err);
      throw err;
    }
  }

  /**
   * Remove and disconnect a framework.
   */
  async removeFramework(name: string): Promise<void> {
    const runtime = this.frameworks.get(name);
    if (!runtime) return;

    await runtime.client.disconnect();
    this.frameworks.delete(name);
  }

  /**
   * Get a framework's runtime state.
   */
  getFramework(name: string): FrameworkRuntime | undefined {
    return this.frameworks.get(name);
  }

  /**
   * List all registered frameworks and their status.
   */
  listFrameworks(): FrameworkRuntime[] {
    return Array.from(this.frameworks.values());
  }

  /**
   * Forward a JSON-RPC call to a specific framework.
   */
  async forwardCall(
    frameworkId: string,
    method: string,
    params?: unknown[] | Record<string, unknown>,
  ): Promise<unknown> {
    const runtime = this.frameworks.get(frameworkId);
    if (!runtime) {
      throw new NexysProtocolError(
        `Framework "${frameworkId}" is not registered`,
      );
    }
    if (!runtime.healthy) {
      throw new NexysProtocolError(
        `Framework "${frameworkId}" is unhealthy: ${runtime.lastError ?? 'unknown'}`,
      );
    }
    return runtime.client.call(method, params);
  }

  /**
   * Restart a failed framework (up to maxRestarts).
   */
  async restartFramework(name: string): Promise<FrameworkDiscovery> {
    const runtime = this.frameworks.get(name);
    if (!runtime) {
      throw new NexysProtocolError(`Framework "${name}" is not registered`);
    }

    if (runtime.restartCount >= this.maxRestarts) {
      throw new NexysProtocolError(
        `Framework "${name}" exceeded max restarts (${this.maxRestarts})`,
      );
    }

    // Disconnect old process
    await runtime.client.disconnect().catch(() => { /* ignore */ });

    runtime.restartCount++;
    runtime.healthy = false;
    runtime.lastError = undefined;

    // Delay before restart
    await new Promise((r) => setTimeout(r, this.restartDelayMs));

    await runtime.client.connect();
    const discovery = await runtime.client.listCapabilities();
    runtime.discovery = discovery;
    runtime.healthy = true;
    return discovery;
  }

  /**
   * Run health checks on all frameworks.
   * Attempts auto-restart for unhealthy ones.
   */
  async healthCheckAll(): Promise<Map<string, { healthy: boolean; status: string; error?: string }>> {
    const results = new Map<string, { healthy: boolean; status: string; error?: string }>();

    for (const [name, runtime] of this.frameworks) {
      if (!runtime.healthy) {
        results.set(name, { healthy: false, status: 'dead', error: runtime.lastError });
        continue;
      }

      try {
        const health = await runtime.client.healthCheck();
        results.set(name, { healthy: true, status: health.status });
      } catch (err) {
        runtime.healthy = false;
        runtime.lastError = err instanceof Error ? err.message : String(err);
        results.set(name, { healthy: false, status: 'error', error: runtime.lastError });

        // Attempt auto-restart
        try {
          await this.restartFramework(name);
          results.set(name, { healthy: true, status: 'restarted' });
        } catch {
          // restart failed, keep error status
        }
      }
    }

    return results;
  }

  /**
   * Shutdown all frameworks gracefully.
   */
  async shutdownAll(): Promise<void> {
    const shutdowns = Array.from(this.frameworks.keys()).map((name) =>
      this.removeFramework(name).catch((err) => {
        console.warn(`[nexys-bridge] Error shutting down "${name}": ${err.message}`);
      }),
    );
    await Promise.all(shutdowns);
  }

  /**
   * Number of registered frameworks.
   */
  get count(): number {
    return this.frameworks.size;
  }
}
