/** Supervisor agent that coordinates workers */
import { BaseAgent, AgentState } from './base_agent.js';
import { BuilderAgent } from './workers/builder.js';
import { DeployerAgent } from './workers/deployer.js';
import { ExecutorAgent } from './workers/executor.js';

export interface SupervisorState extends AgentState {
  currentTask: string;
  assignedWorker: string;
  taskHistory: Array<{ task: string; worker: string; timestamp: string }>;
}

export class SupervisorAgent extends BaseAgent {
  private workers: {
    builder: BuilderAgent;
    deployer: DeployerAgent;
    executor: ExecutorAgent;
  };

  constructor() {
    super('supervisor');
    this.workers = {
      builder: new BuilderAgent(),
      deployer: new DeployerAgent(),
      executor: new ExecutorAgent(),
    };
  }

  async reason(state: AgentState): Promise<AgentState> {
    const lastMessage = state.messages[state.messages.length - 1];
    const taskContent = lastMessage?.content || '';

    // Simple routing logic (can be enhanced with LLM)
    const supervisorState = state as SupervisorState;

    if (taskContent.toLowerCase().includes('build') || taskContent.toLowerCase().includes('create')) {
      supervisorState.assignedWorker = 'builder';
      supervisorState.currentTask = 'build';
    } else if (taskContent.toLowerCase().includes('deploy') || taskContent.toLowerCase().includes('release')) {
      supervisorState.assignedWorker = 'deployer';
      supervisorState.currentTask = 'deploy';
    } else if (taskContent.toLowerCase().includes('execute') || taskContent.toLowerCase().includes('run')) {
      supervisorState.assignedWorker = 'executor';
      supervisorState.currentTask = 'execute';
    } else {
      supervisorState.assignedWorker = 'builder'; // Default
      supervisorState.currentTask = 'build';
    }

    this.log.info(`Routed task to ${supervisorState.assignedWorker}`);
    return supervisorState;
  }

  async act(state: AgentState): Promise<AgentState> {
    const supervisorState = state as SupervisorState;
    const workerName = supervisorState.assignedWorker as keyof typeof this.workers;

    if (workerName && this.workers[workerName]) {
      const worker = this.workers[workerName];
      const result = await worker.run({
        messages: state.messages,
        context: state.context,
      });

      // Merge results
      supervisorState.messages.push(...result.messages);
      supervisorState.context = { ...supervisorState.context, ...result.context };
      supervisorState.toolsUsed.push(...result.toolsUsed);

      // Update history
      supervisorState.taskHistory = supervisorState.taskHistory || [];
      supervisorState.taskHistory.push({
        task: supervisorState.currentTask,
        worker: supervisorState.assignedWorker,
        timestamp: this.stateManager.getTimestamp(),
      });
    }

    return supervisorState;
  }
}

