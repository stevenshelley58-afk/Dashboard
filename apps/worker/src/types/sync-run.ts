import type { JobType } from "../job-types.js";

export interface SyncRunRecord {
  sync_run_id: string;
  integration_id: string;
  job_type: JobType | string;
  trigger: string | null;
  retry_count: number | null;
}




