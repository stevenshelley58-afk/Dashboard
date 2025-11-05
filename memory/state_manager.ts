/** State management with checkpointing */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const CHECKPOINT_DIR = '.checkpoints';

export interface CheckpointData {
  agentName: string;
  checkpointId: string;
  timestamp: string;
  state: Record<string, unknown>;
}

export class StateManager {
  private checkpointDir: string;

  constructor(checkpointDir: string = CHECKPOINT_DIR) {
    this.checkpointDir = checkpointDir;
    if (!existsSync(checkpointDir)) {
      mkdirSync(checkpointDir, { recursive: true });
    }
  }

  saveCheckpoint(agentName: string, checkpointId: string, state: Record<string, unknown>): void {
    const checkpointFile = join(this.checkpointDir, `${agentName}_${checkpointId}.json`);

    const checkpointData: CheckpointData = {
      agentName,
      checkpointId,
      timestamp: this.getTimestamp(),
      state,
    };

    writeFileSync(checkpointFile, JSON.stringify(checkpointData, null, 2), 'utf-8');
  }

  loadCheckpoint(agentName: string, checkpointId: string): CheckpointData | null {
    const checkpointFile = join(this.checkpointDir, `${agentName}_${checkpointId}.json`);

    if (!existsSync(checkpointFile)) {
      return null;
    }

    const content = readFileSync(checkpointFile, 'utf-8');
    return JSON.parse(content) as CheckpointData;
  }

  listCheckpoints(_agentName?: string): string[] {
    // This would need to be implemented with directory reading
    // For now, return empty array
    return [];
  }

  getTimestamp(): string {
    return new Date().toISOString();
  }
}

