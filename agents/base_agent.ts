/** Base agent class with common functionality */
import { StateManager } from '../memory/state_manager.js';
import { ToolVerifier } from '../utils/tool_verifier.js';
import { logger } from '../utils/logger.js';

export interface AgentState {
  messages: Array<{ role: string; content: string }>;
  context: Record<string, unknown>;
  toolsUsed: string[];
  errors: string[];
  checkpointId?: string;
}

export abstract class BaseAgent {
  protected name: string;
  protected stateManager: StateManager;
  protected toolVerifier: ToolVerifier;
  protected log: ReturnType<typeof logger>;

  constructor(name: string) {
    this.name = name;
    this.stateManager = new StateManager();
    this.toolVerifier = new ToolVerifier();
    this.log = logger(name);
  }

  protected verifyTools(requiredTools: string[]): void {
    const missing = this.toolVerifier.getMissingTools(requiredTools);

    if (missing.length > 0) {
      const errorMsg = `Missing required tools: ${missing.join(', ')}`;
      this.log.error(errorMsg);
      throw new Error(errorMsg);
    }

    this.log.info(`All ${requiredTools.length} tools verified`);
  }

  abstract reason(state: AgentState): Promise<AgentState>;
  abstract act(state: AgentState): Promise<AgentState>;

  async observe(state: AgentState): Promise<AgentState> {
    state.context.lastObservation = {
      toolsUsed: state.toolsUsed,
      errors: state.errors,
    };
    return state;
  }

  async run(input: Partial<AgentState>, checkpointId?: string): Promise<AgentState> {
    const state: AgentState = {
      messages: input.messages || [],
      context: input.context || {},
      toolsUsed: [],
      errors: [],
      checkpointId,
    };

    try {
      // ReAct pattern: Reason → Act → Observe
      let currentState = await this.reason(state);
      currentState = await this.act(currentState);
      currentState = await this.observe(currentState);

      // Save checkpoint
      if (checkpointId) {
        this.stateManager.saveCheckpoint(this.name, checkpointId, currentState);
      }

      return currentState;
    } catch (error) {
      state.errors.push(error instanceof Error ? error.message : String(error));
      this.log.error(`Error in agent ${this.name}: ${state.errors[0]}`);
      throw error;
    }
  }
}

