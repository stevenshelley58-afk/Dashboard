export type MetaDatePreset = "today" | "yesterday" | "last_7" | "last_30";

export interface MetaDateRange {
  from: string;
  to: string;
  preset?: MetaDatePreset;
}

export interface MetaAdAccountSummary {
  ad_account_id: string;
  display_name: string | null;
  platform_ad_account_id: string | null;
  currency: string | null;
  timezone: string | null;
}

export interface MetaTimeseriesPoint {
  date: string;
  spend: number;
  purchases: number;
  purchase_value: number;
  roas: number | null;
}

export interface MetaDashboardSummary {
  spend: number;
  purchases: number;
  purchase_value: number;
  roas: number;
}

export interface MetaDashboardResponse {
  adAccount: MetaAdAccountSummary;
  range: MetaDateRange;
  summary: MetaDashboardSummary;
  timeseries: MetaTimeseriesPoint[];
  meta: {
    hasData: boolean;
  };
}


