/** Tool registry for verification - TypeScript/Node.js stack focused */
import { execSync } from 'child_process';

export interface ToolInfo {
  type: 'command' | 'npm' | 'cli';
  verifyCommand: string[];
  installCommand?: string;
  versionFlag?: string;
}

export class ToolsRegistry {
  private tools: Map<string, ToolInfo> = new Map();

  constructor() {
    this.loadRegistry();
  }

  private loadRegistry() {
    // Core development tools
    this.tools.set('node', {
      type: 'command',
      verifyCommand: ['node', '--version'],
      versionFlag: '--version',
    });

    this.tools.set('npm', {
      type: 'command',
      verifyCommand: ['npm', '--version'],
      versionFlag: '--version',
    });

    this.tools.set('git', {
      type: 'command',
      verifyCommand: ['git', '--version'],
      versionFlag: '--version',
    });

    // Project-specific CLIs
    this.tools.set('vercel', {
      type: 'npm',
      verifyCommand: ['vercel', '--version'],
      installCommand: 'npm install -g vercel',
    });

    this.tools.set('supabase', {
      type: 'npm',
      verifyCommand: ['supabase', '--version'],
      installCommand: 'npm install -g supabase',
    });

    this.tools.set('railway', {
      type: 'npm',
      verifyCommand: ['railway', '--version'],
      installCommand: 'npm install -g @railway/cli',
    });

    // Optional but recommended
    this.tools.set('gh', {
      type: 'command',
      verifyCommand: ['gh', '--version'],
      installCommand: 'See: https://cli.github.com/',
    });
  }

  registerTool(name: string, info: ToolInfo): void {
    this.tools.set(name, info);
  }

  verifyTool(name: string): boolean {
    const tool = this.tools.get(name);
    if (!tool) {
      return false;
    }

    try {
      execSync(tool.verifyCommand.join(' '), {
        stdio: 'ignore',
        timeout: 5000,
      });
      return true;
    } catch {
      return false;
    }
  }

  verifyAll(toolNames: string[]): Record<string, boolean> {
    return toolNames.reduce(
      (acc, name) => {
        acc[name] = this.verifyTool(name);
        return acc;
      },
      {} as Record<string, boolean>
    );
  }

  listTools(): string[] {
    return Array.from(this.tools.keys());
  }

  getMissingTools(required: string[]): string[] {
    return required.filter((tool) => !this.verifyTool(tool));
  }
}

