/** Tool verification utilities */
import { ToolsRegistry } from '../config/tools_registry.js';
import { logger } from './logger.js';

export class ToolVerifier {
  private registry: ToolsRegistry;

  constructor() {
    this.registry = new ToolsRegistry();
  }

  verify(toolName: string): boolean {
    const isAvailable = this.registry.verifyTool(toolName);

    if (!isAvailable) {
      logger.warn(`Tool ${toolName} is not available`);
    }

    return isAvailable;
  }

  verifyAll(toolNames: string[]): Record<string, boolean> {
    return this.registry.verifyAll(toolNames);
  }

  getMissingTools(required: string[]): string[] {
    return this.registry.getMissingTools(required);
  }

  verifyStack(): {
    core: Record<string, boolean>;
    clis: Record<string, boolean>;
    allAvailable: boolean;
    missing: string[];
  } {
    const core = this.verifyAll(['node', 'npm', 'git']);
    const clis = this.verifyAll(['vercel', 'supabase', 'railway']);
    const allTools = { ...core, ...clis };
    const missing = Object.entries(allTools)
      .filter(([, available]) => !available)
      .map(([tool]) => tool);

    return {
      core,
      clis,
      allAvailable: missing.length === 0,
      missing,
    };
  }
}

