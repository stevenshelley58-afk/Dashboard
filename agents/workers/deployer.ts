/** Deployer agent for deployment tasks */
import { BaseAgent, AgentState } from '../base_agent.js';
import { execSync } from 'child_process';

export class DeployerAgent extends BaseAgent {
  constructor() {
    super('deployer');
    this.verifyTools(['git']);
  }

  async reason(state: AgentState): Promise<AgentState> {
    state.context.deploymentPlan = 'Deploy after verification';
    return state;
  }

  async act(state: AgentState): Promise<AgentState> {
    const commitMessage = (state.context.commitMessage as string) || 'feat: deploy changes';

    try {
      // Stage all changes
      execSync('git add .', { stdio: 'inherit' });
      
      // Commit
      execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
      
      state.toolsUsed.push('git_commit');
      state.messages.push({
        role: 'assistant',
        content: `Committed: ${commitMessage}`,
      });

      this.log.info('Deployment commit created');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      state.errors.push(`Git commit error: ${errorMsg}`);
      this.log.error(`Deployment failed: ${errorMsg}`);
    }

    return state;
  }
}

