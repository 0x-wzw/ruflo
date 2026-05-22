/**
 * NecroSwarm Adapter for ruflo
 * 
 * Port of SwarmWeaver adapter from unified_platform.
 * Manages worker pools, task decomposition, and swarm coordination.
 */

import { RufloPlugin, PluginContext } from 'ruflo';

export interface Worker {
  id: string;
  status: 'idle' | 'busy' | 'offline';
  capabilities: string[];
  currentTask?: string;
  lastHeartbeat: Date;
}

export interface SwarmTask {
  id: string;
  description: string;
  subtasks: Subtask[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export interface Subtask {
  id: string;
  description: string;
  assignedWorker?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: any;
}

export class NecroSwarmAdapter implements RufloPlugin {
  id = 'necroswarm';
  name = 'NecroSwarm';
  version = '1.0.0';
  
  private context?: PluginContext;
  private workers: Map<string, Worker> = new Map();
  private swarms: Map<string, SwarmTask> = new Map();
  private workerPoolSize = 4;

  async initialize(context: PluginContext): Promise<void> {
    this.context = context;
    
    // Initialize default worker pool
    await this.initializeWorkerPool(this.workerPoolSize);
    
    context.log.info(`NecroSwarm: Initialized with ${this.workerPoolSize} workers`);
  }

  private async initializeWorkerPool(size: number): Promise<void> {
    for (let i = 0; i < size; i++) {
      const worker: Worker = {
        id: `worker-${i}`,
        status: 'idle',
        capabilities: ['general', 'code', 'analysis'],
        lastHeartbeat: new Date()
      };
      
      this.workers.set(worker.id, worker);
    }
  }

  async handleCommand(command: string, args: string[]): Promise<any> {
    switch (command) {
      case 'swarm-init':
        return this.swarmInit(args);
      case 'swarm-deploy':
        return this.swarmDeploy(args);
      case 'swarm-status':
        return this.swarmStatus();
      case 'swarm-scale':
        return this.swarmScale(args);
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }

  /**
   * Initialize a new swarm for task execution
   */
  private async swarmInit(args: string[]): Promise<any> {
    const swarmId = `swarm-${Date.now()}`;
    const taskDescription = args[0] || 'Untitled task';
    
    // Decompose task into subtasks
    const subtasks = await this.decomposeTask(taskDescription);
    
    const swarm: SwarmTask = {
      id: swarmId,
      description: taskDescription,
      subtasks,
      status: 'pending'
    };
    
    this.swarms.set(swarmId, swarm);
    
    this.context?.log.info(`Swarm ${swarmId} initialized with ${subtasks.length} subtasks`);
    
    return {
      swarmId,
      task: taskDescription,
      subtasks: subtasks.length,
      workers: this.workers.size
    };
  }

  /**
   * Decompose a task into parallel subtasks
   * This is the core SwarmWeaver logic
   */
  private async decomposeTask(description: string): Promise<Subtask[]> {
    // Simple decomposition - in production this would use LLM
    const subtasks: Subtask[] = [
      {
        id: `subtask-${Date.now()}-1`,
        description: `Analyze: ${description}`,
        status: 'pending'
      },
      {
        id: `subtask-${Date.now()}-2`,
        description: `Execute: ${description}`,
        status: 'pending'
      },
      {
        id: `subtask-${Date.now()}-3`,
        description: `Verify: ${description}`,
        status: 'pending'
      }
    ];
    
    return subtasks;
  }

  /**
   * Deploy swarm to execute task
   */
  private async swarmDeploy(args: string[]): Promise<any> {
    const swarmId = args[0];
    const swarm = this.swarms.get(swarmId);
    
    if (!swarm) {
      throw new Error(`Swarm ${swarmId} not found`);
    }
    
    swarm.status = 'in_progress';
    
    // Assign subtasks to idle workers
    const assignments = this.assignSubtasks(swarm.subtasks);
    
    // Execute in parallel (simulated)
    const results = await this.executeParallel(assignments);
    
    swarm.status = 'completed';
    
    return {
      swarmId,
      status: 'completed',
      assignments: assignments.length,
      results
    };
  }

  /**
   * Assign subtasks to available workers
   */
  private assignSubtasks(subtasks: Subtask[]): Array<{subtask: Subtask; worker: Worker}> {
    const assignments: Array<{subtask: Subtask; worker: Worker}> = [];
    const idleWorkers = Array.from(this.workers.values())
      .filter(w => w.status === 'idle');
    
    for (let i = 0; i < subtasks.length && i < idleWorkers.length; i++) {
      const subtask = subtasks[i];
      const worker = idleWorkers[i];
      
      subtask.assignedWorker = worker.id;
      subtask.status = 'in_progress';
      worker.status = 'busy';
      worker.currentTask = subtask.id;
      
      assignments.push({ subtask, worker });
    }
    
    return assignments;
  }

  /**
   * Execute assignments in parallel
   */
  private async executeParallel(
    assignments: Array<{subtask: Subtask; worker: Worker}>
  ): Promise<any[]> {
    const promises = assignments.map(async ({ subtask, worker }) => {
      // Simulate task execution
      await this.simulateExecution(subtask);
      
      subtask.status = 'completed';
      subtask.result = { worker: worker.id, completed: new Date() };
      
      worker.status = 'idle';
      worker.currentTask = undefined;
      
      return subtask.result;
    });
    
    return Promise.all(promises);
  }

  private async simulateExecution(subtask: Subtask): Promise<void> {
    // Simulate work duration
    const duration = 1000 + Math.random() * 2000;
    await new Promise(resolve => setTimeout(resolve, duration));
  }

  /**
   * Get swarm and worker status
   */
  private async swarmStatus(): Promise<any> {
    const workers = Array.from(this.workers.values()).map(w => ({
      id: w.id,
      status: w.status,
      capabilities: w.capabilities,
      currentTask: w.currentTask,
      lastHeartbeat: w.lastHeartbeat
    }));
    
    const swarms = Array.from(this.swarms.values()).map(s => ({
      id: s.id,
      description: s.description,
      status: s.status,
      subtasks: s.subtasks.length,
      completed: s.subtasks.filter(st => st.status === 'completed').length
    }));
    
    return {
      workers: {
        total: workers.length,
        idle: workers.filter(w => w.status === 'idle').length,
        busy: workers.filter(w => w.status === 'busy').length,
        list: workers
      },
      swarms: {
        total: swarms.length,
        active: swarms.filter(s => s.status === 'in_progress').length,
        list: swarms
      }
    };
  }

  /**
   * Scale worker pool
   */
  private async swarmScale(args: string[]): Promise<any> {
    const targetSize = parseInt(args[0], 10);
    
    if (isNaN(targetSize) || targetSize < 1) {
      throw new Error('Invalid pool size');
    }
    
    const currentSize = this.workers.size;
    
    if (targetSize > currentSize) {
      // Add workers
      for (let i = currentSize; i < targetSize; i++) {
        const worker: Worker = {
          id: `worker-${i}`,
          status: 'idle',
          capabilities: ['general', 'code', 'analysis'],
          lastHeartbeat: new Date()
        };
        this.workers.set(worker.id, worker);
      }
    } else if (targetSize < currentSize) {
      // Remove idle workers
      const toRemove = currentSize - targetSize;
      const idleWorkers = Array.from(this.workers.values())
        .filter(w => w.status === 'idle')
        .slice(0, toRemove);
      
      for (const worker of idleWorkers) {
        this.workers.delete(worker.id);
      }
    }
    
    this.workerPoolSize = targetSize;
    
    return {
      previous: currentSize,
      current: this.workers.size,
      target: targetSize
    };
  }

  /**
   * Get available workers for task assignment
   */
  getAvailableWorkers(): Worker[] {
    return Array.from(this.workers.values())
      .filter(w => w.status === 'idle');
  }

  /**
   * Get swarm by ID
   */
  getSwarm(id: string): SwarmTask | undefined {
    return this.swarms.get(id);
  }
}

export default NecroSwarmAdapter;
