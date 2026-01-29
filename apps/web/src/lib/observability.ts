/**
 * Observability utilities for structured logging, correlation IDs, and metrics
 */

import { randomUUID } from "node:crypto";

// AsyncLocalStorage for correlation context
let currentCorrelationId: string | null = null;
let currentRequestStartTime: number | null = null;

/**
 * Set the correlation ID for the current request
 */
export function setCorrelationId(id: string): void {
  currentCorrelationId = id;
}

/**
 * Get the current correlation ID
 */
export function getCorrelationId(): string {
  if (!currentCorrelationId) {
    currentCorrelationId = randomUUID();
  }
  return currentCorrelationId;
}

/**
 * Clear the correlation ID
 */
export function clearCorrelationId(): void {
  currentCorrelationId = null;
  currentRequestStartTime = null;
}

/**
 * Start timing a request
 */
export function startRequestTimer(): void {
  currentRequestStartTime = Date.now();
}

/**
 * Get elapsed time since request started
 */
export function getElapsedTime(): number | null {
  if (!currentRequestStartTime) {
    return null;
  }
  return Date.now() - currentRequestStartTime;
}

/**
 * Log levels
 */
type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId: string;
  [key: string]: unknown;
}

/**
 * Structured logger
 */
function log(level: LogLevel, message: string, meta: Record<string, unknown> = {}): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    correlationId: getCorrelationId(),
    ...meta,
  };

  // In production, you might want to send this to a log aggregator
  // For now, we log to console in JSON format
  const logFn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  logFn(JSON.stringify(entry));
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => log("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) => log("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log("error", message, meta),
};

/**
 * Middleware to set up correlation context for a request
 */
export async function withCorrelationContext<T>(
  correlationId: string | undefined,
  fn: () => Promise<T>
): Promise<T> {
  setCorrelationId(correlationId || randomUUID());
  startRequestTimer();
  
  try {
    return await fn();
  } finally {
    clearCorrelationId();
  }
}

/**
 * Simple metrics collector
 */
class MetricsCollector {
  private counters: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();

  increment(name: string, value = 1): void {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
  }

  recordHistogram(name: string, value: number): void {
    const values = this.histograms.get(name) || [];
    values.push(value);
    this.histograms.set(name, values);
  }

  getCounter(name: string): number {
    return this.counters.get(name) || 0;
  }

  getHistogram(name: string): { count: number; min: number; max: number; avg: number } | null {
    const values = this.histograms.get(name);
    if (!values || values.length === 0) {
      return null;
    }

    const count = values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / count;

    return { count, min, max, avg };
  }

  reset(): void {
    this.counters.clear();
    this.histograms.clear();
  }

  getAllMetrics(): Record<string, unknown> {
    const result: Record<string, unknown> = {
      counters: Object.fromEntries(this.counters),
    };

    for (const [name] of this.histograms) {
      result[`histogram_${name}`] = this.getHistogram(name);
    }

    return result;
  }
}

export const metrics = new MetricsCollector();
