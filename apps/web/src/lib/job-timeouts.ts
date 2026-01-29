/**
 * Job timeout enforcement for worker operations
 * Prevents runaway jobs from blocking the queue indefinitely
 */

import { logger } from "./observability.js";

const DEFAULT_JOB_TIMEOUT_MS = 60_000; // 60 seconds
const WARNING_THRESHOLD_MS = 30_000; // Warn if job takes longer than 30s

interface JobContext {
  jobId: string;
  jobType: string;
  integrationId: string;
  startTime: number;
  timeoutMs: number;
  timeoutHandle?: NodeJS.Timeout;
  warningHandle?: NodeJS.Timeout;
}

let currentJobContext: JobContext | null = null;

/**
 * Start a job with timeout enforcement
 */
export function startJob(
  jobId: string,
  jobType: string,
  integrationId: string,
  timeoutMs: number = DEFAULT_JOB_TIMEOUT_MS
): void {
  if (currentJobContext) {
    logger.warn("Starting new job while another is in progress", {
      previousJobId: currentJobContext.jobId,
      newJobId: jobId,
    });
  }

  const startTime = Date.now();
  
  currentJobContext = {
    jobId,
    jobType,
    integrationId,
    startTime,
    timeoutMs,
  };

  // Set up warning timer
  if (WARNING_THRESHOLD_MS < timeoutMs) {
    currentJobContext.warningHandle = setTimeout(() => {
      logger.warn("Job is taking longer than expected", {
        jobId,
        jobType,
        integrationId,
        elapsedMs: Date.now() - startTime,
        thresholdMs: WARNING_THRESHOLD_MS,
      });
    }, WARNING_THRESHOLD_MS);
  }

  // Set up timeout timer
  currentJobContext.timeoutHandle = setTimeout(() => {
    logger.error("Job timeout - forcing termination", {
      jobId,
      jobType,
      integrationId,
      elapsedMs: Date.now() - startTime,
      timeoutMs,
    });
    
    // In a real implementation, you might want to:
    // 1. Update the job status to 'timeout'
    // 2. Throw an error to stop execution
    // 3. Trigger an alert
    
    throw new Error(
      `Job ${jobId} (${jobType}) timed out after ${timeoutMs}ms`
    );
  }, timeoutMs);

  logger.info("Job started", {
    jobId,
    jobType,
    integrationId,
    timeoutMs,
  });
}

/**
 * Complete the current job and clear timers
 */
export function completeJob(stats?: Record<string, unknown>): void {
  if (!currentJobContext) {
    logger.warn("completeJob called with no active job");
    return;
  }

  const { jobId, jobType, integrationId, startTime, timeoutHandle, warningHandle } = currentJobContext;
  const elapsedMs = Date.now() - startTime;

  // Clear timers
  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
  }
  if (warningHandle) {
    clearTimeout(warningHandle);
  }

  logger.info("Job completed", {
    jobId,
    jobType,
    integrationId,
    elapsedMs,
    ...stats,
  });

  currentJobContext = null;
}

/**
 * Fail the current job and clear timers
 */
export function failJob(error: unknown): void {
  if (!currentJobContext) {
    logger.warn("failJob called with no active job", { error });
    return;
  }

  const { jobId, jobType, integrationId, startTime, timeoutHandle, warningHandle } = currentJobContext;
  const elapsedMs = Date.now() - startTime;

  // Clear timers
  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
  }
  if (warningHandle) {
    clearTimeout(warningHandle);
  }

  logger.error("Job failed", {
    jobId,
    jobType,
    integrationId,
    elapsedMs,
    error: error instanceof Error ? error.message : String(error),
  });

  currentJobContext = null;
}

/**
 * Get the current job context
 */
export function getCurrentJobContext(): JobContext | null {
  return currentJobContext;
}

/**
 * Check if a job is currently running
 */
export function isJobRunning(): boolean {
  return currentJobContext !== null;
}

/**
 * Get elapsed time for current job
 */
export function getJobElapsedTime(): number | null {
  if (!currentJobContext) {
    return null;
  }
  return Date.now() - currentJobContext.startTime;
}

/**
 * Extend the timeout for the current job
 * Use this if you know a job will take longer than expected
 */
export function extendTimeout(additionalMs: number): void {
  if (!currentJobContext) {
    logger.warn("extendTimeout called with no active job");
    return;
  }

  const { timeoutHandle, timeoutMs } = currentJobContext;
  
  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
  }

  const newTimeoutMs = timeoutMs + additionalMs;
  currentJobContext.timeoutMs = newTimeoutMs;
  
  currentJobContext.timeoutHandle = setTimeout(() => {
    logger.error("Job timeout (extended) - forcing termination", {
      jobId: currentJobContext?.jobId,
      jobType: currentJobContext?.jobType,
      elapsedMs: Date.now() - (currentJobContext?.startTime || 0),
      timeoutMs: newTimeoutMs,
    });
    
    throw new Error(
      `Job ${currentJobContext?.jobId} timed out after ${newTimeoutMs}ms (extended)`
    );
  }, newTimeoutMs - (Date.now() - currentJobContext.startTime));

  logger.info("Job timeout extended", {
    jobId: currentJobContext.jobId,
    additionalMs,
    newTimeoutMs,
  });
}
