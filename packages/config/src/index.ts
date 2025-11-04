/** Shared types and configuration for the data pipeline */
import { z } from 'zod';

// Job lifecycle enums
export enum RunStatus {
  QUEUED = 'QUEUED',
  IN_PROGRESS = 'IN_PROGRESS',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  PARTIAL = 'PARTIAL',
}

export enum JobType {
  HISTORICAL = 'HISTORICAL',
  INCREMENTAL = 'INCREMENTAL',
}

export enum Platform {
  SHOPIFY = 'SHOPIFY',
  META = 'META',
  GA4 = 'GA4',
  KLAVIYO = 'KLAVIYO',
}

// Error payload schema
export const ErrorPayloadSchema = z.object({
  code: z.string(),
  message: z.string(),
  service: z.string(),
  task: z.string(),
  stack_trace: z.string().optional(),
});

export type ErrorPayload = z.infer<typeof ErrorPayloadSchema>;

// Sync API request schema
export const SyncRequestSchema = z.object({
  shop_id: z.string(),
  job_type: z.nativeEnum(JobType),
  platform: z.nativeEnum(Platform),
});

export type SyncRequest = z.infer<typeof SyncRequestSchema>;

// Sync API response schema
export const SyncResponseSchema = z.object({
  run_id: z.string(),
});

export type SyncResponse = z.infer<typeof SyncResponseSchema>;

// ETL Run schema (matches database)
export const ETLRunSchema = z.object({
  id: z.string().uuid(),
  shop_id: z.string(),
  status: z.nativeEnum(RunStatus),
  job_type: z.nativeEnum(JobType),
  platform: z.nativeEnum(Platform),
  error: ErrorPayloadSchema.nullable(),
  records_synced: z.number().int().nullable(),
  created_at: z.string(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
});

export type ETLRun = z.infer<typeof ETLRunSchema>;

