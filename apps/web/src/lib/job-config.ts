export const META_JOB_TYPES = ["meta_7d_fill", "meta_fresh"] as const;
export type MetaJobType = (typeof META_JOB_TYPES)[number];

const META_JOB_SET = new Set<MetaJobType>(META_JOB_TYPES);

const META_JOBS_ENABLED =
  (process.env.META_JOBS_ENABLED ?? "true").toLowerCase() !== "false";

export function metaJobsEnabled(): boolean {
  return META_JOBS_ENABLED;
}

export function isMetaJobType(value: string): value is MetaJobType {
  return META_JOB_SET.has(value as MetaJobType);
}

export function getMetaJobTypes(): readonly MetaJobType[] {
  return META_JOB_TYPES;
}


