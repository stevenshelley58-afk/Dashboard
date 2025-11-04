/** Logging utilities */
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const LOG_DIR = 'logs';
const LOG_FILE = join(LOG_DIR, 'agents.log');

// Ensure log directory exists
if (!existsSync(LOG_DIR)) {
  mkdirSync(LOG_DIR, { recursive: true });
}

const logStream = createWriteStream(LOG_FILE, { flags: 'a' });

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  private format(level: string, name: string, message: string, ...args: unknown[]): string {
    const timestamp = new Date().toISOString();
    const argsStr = args.length > 0 ? ' ' + JSON.stringify(args) : '';
    return `[${timestamp}] [${level}] [${name}] ${message}${argsStr}\n`;
  }

  private log(level: LogLevel, levelName: string, name: string, message: string, ...args: unknown[]): void {
    if (level >= this.level) {
      const formatted = this.format(levelName, name, message, ...args);
      process.stdout.write(formatted);
      logStream.write(formatted);
    }
  }

  debug(name: string, message: string, ...args: unknown[]): void {
    this.log(LogLevel.DEBUG, 'DEBUG', name, message, ...args);
  }

  info(name: string, message: string, ...args: unknown[]): void {
    this.log(LogLevel.INFO, 'INFO', name, message, ...args);
  }

  warn(name: string, message: string, ...args: unknown[]): void {
    this.log(LogLevel.WARN, 'WARN', name, message, ...args);
  }

  error(name: string, message: string, ...args: unknown[]): void {
    this.log(LogLevel.ERROR, 'ERROR', name, message, ...args);
  }
}

const defaultLogger = new Logger(
  process.env.LOG_LEVEL === 'DEBUG' ? LogLevel.DEBUG : LogLevel.INFO
);

export function logger(name: string = 'default'): ReturnType<typeof defaultLogger.info> extends (...args: unknown[]) => void
  ? typeof defaultLogger
  : never {
  return {
    debug: (message: string, ...args: unknown[]) => defaultLogger.debug(name, message, ...args),
    info: (message: string, ...args: unknown[]) => defaultLogger.info(name, message, ...args),
    warn: (message: string, ...args: unknown[]) => defaultLogger.warn(name, message, ...args),
    error: (message: string, ...args: unknown[]) => defaultLogger.error(name, message, ...args),
  };
}

