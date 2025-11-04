/** Executor agent for running/executing tasks */
import { BaseAgent, AgentState } from '../base_agent.js';

export class ExecutorAgent extends BaseAgent {
  constructor() {
    super('executor');
  }

  async reason(state: AgentState): Promise<AgentState> {
    state.context.executionPlan = 'Execute task';
    return state;
  }

  async act(state: AgentState): Promise<AgentState> {
    state.context.executionResult = 'Task executed successfully';
    state.messages.push({
      role: 'assistant',
      content: 'Execution completed',
    });

    this.log.info('Execution completed');
    return state;
  }
}

