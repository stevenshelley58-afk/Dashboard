/** Builder agent for creating/implementing features */
import { BaseAgent, AgentState } from '../base_agent.js';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';

export class BuilderAgent extends BaseAgent {
  constructor() {
    super('builder');
    this.verifyTools(['node', 'npm', 'git']);
  }

  async reason(state: AgentState): Promise<AgentState> {
    const lastMsg = state.messages[state.messages.length - 1];
    const task = lastMsg?.content || '';

    state.context.reasoning = `Analyzing task: ${task}`;
    state.context.plan = [
      '1. Understand requirements',
      '2. Create necessary files',
      '3. Implement functionality',
      '4. Verify implementation',
    ];

    this.log.info('Reasoning completed');
    return state;
  }

  async act(state: AgentState): Promise<AgentState> {
    const context = state.context as Record<string, unknown>;
    const plan = context.plan as string[];

    this.log.info('Executing build actions...');

    // Create files based on context
    if (context.filesToCreate) {
      const files = context.filesToCreate as Array<{ path: string; content: string }>;
      for (const file of files) {
        this.createFile(file.path, file.content);
      }
    }

    state.toolsUsed.push('builder_action');
    state.messages.push({
      role: 'assistant',
      content: 'Implementation created',
    });

    this.log.info('Action executed');
    return state;
  }

  private createFile(filePath: string, content: string): void {
    const fullPath = join(process.cwd(), filePath);
    const dir = dirname(fullPath);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(fullPath, content, 'utf-8');
    this.log.info(`Created file: ${filePath}`);
  }

  private readFile(filePath: string): string {
    const fullPath = join(process.cwd(), filePath);
    return readFileSync(fullPath, 'utf-8');
  }
}

