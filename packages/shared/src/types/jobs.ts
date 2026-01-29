/**
 * Job types and interfaces shared between web and worker
 */

export const JOB_TYPES = [
  "shopify_7d_fill",
  "shopify_fresh",
  "meta_7d_fill",
  "meta_fresh",
] as const;

export type JobType = (typeof JOB_TYPES)[number];

export function isKnownJobType(value: string): value is JobType {
  return JOB_TYPES.includes(value as JobType);
}

export interface SyncRunRecord {
  sync_run_id: string;
  integration_id: string;
  job_type: JobType;
  trigger: string;
  retry_count: number;
}

export interface JobResult {
  stats?: Record<string, unknown>;
}

export type JobHandler = (run: SyncRunRecord) => Promise<JobResult>;

export const META_JOB_TYPES = ["meta_7d_fill", "meta_fresh"] as const;
export type MetaJobType = (typeof META_JOB_TYPES)[number];

const META_JOB_SET = new Set<MetaJobType>(META_JOB_TYPES);

export function isMetaJobType(value: string): value is MetaJobType {
  return META_JOB_SET.has(value as MetaJobType);
}

export function getMetaJobTypes(): readonly MetaJobType[] {
  return META_JOB_TYPES;
}
