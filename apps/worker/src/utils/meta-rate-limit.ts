/**
 * Meta Marketing API rate limiting utilities
 * 
 * Uses response headers to drive backoff decisions:
 * - X-Ad-Account-Usage: ad account level limits
 * - X-Business-Use-Case: business use case limits  
 * - X-FB-Ads-Insights-Throttle: Insights API load limits
 * 
 * Docs: https://developers.facebook.com/docs/marketing-api/overview/rate-limiting
 */

export interface MetaRateLimitHeaders {
  'X-Ad-Account-Usage'?: string;
  'X-Business-Use-Case'?: string;
  'X-FB-Ads-Insights-Throttle'?: string;
}

export interface ParsedRateLimitInfo {
  adAccountUtilPct: number | null;
  appUtilPct: number | null;
  accIdUtilPct: number | null;
  resetTimeDuration: number | null;
  estimatedTimeToRegainAccess: number | null;
  adsApiAccessTier: string | null;
}

/**
 * Parse X-Ad-Account-Usage header
 * Format: JSON with acc_id_util_pct, reset_time_duration, ads_api_access_tier
 */
export function parseAdAccountUsage(header: string | null): Partial<ParsedRateLimitInfo> {
  if (!header) return {};
  
  try {
    const parsed = JSON.parse(header);
    return {
      adAccountUtilPct: typeof parsed.acc_id_util_pct === 'number' ? parsed.acc_id_util_pct : null,
      resetTimeDuration: typeof parsed.reset_time_duration === 'number' ? parsed.reset_time_duration : null,
      adsApiAccessTier: typeof parsed.ads_api_access_tier === 'string' ? parsed.ads_api_access_tier : null,
    };
  } catch {
    return {};
  }
}

/**
 * Parse X-FB-Ads-Insights-Throttle header
 * Format: JSON with app_id_util_pct, acc_id_util_pct, ads_api_access_tier
 */
export function parseInsightsThrottle(header: string | null): Partial<ParsedRateLimitInfo> {
  if (!header) return {};
  
  try {
    const parsed = JSON.parse(header);
    return {
      appUtilPct: typeof parsed.app_id_util_pct === 'number' ? parsed.app_id_util_pct : null,
      accIdUtilPct: typeof parsed.acc_id_util_pct === 'number' ? parsed.acc_id_util_pct : null,
      adsApiAccessTier: typeof parsed.ads_api_access_tier === 'string' ? parsed.ads_api_access_tier : null,
    };
  } catch {
    return {};
  }
}

/**
 * Parse X-Business-Use-Case header
 * Format: JSON with call_count, total_cputime, total_time, estimated_time_to_regain_access
 */
export function parseBusinessUseCase(header: string | null): Partial<ParsedRateLimitInfo> {
  if (!header) return {};
  
  try {
    const parsed = JSON.parse(header);
    return {
      estimatedTimeToRegainAccess: typeof parsed.estimated_time_to_regain_access === 'number' 
        ? parsed.estimated_time_to_regain_access 
        : null,
    };
  } catch {
    return {};
  }
}

/**
 * Extract rate limit info from response headers
 */
export function extractRateLimitInfo(headers: Headers): ParsedRateLimitInfo {
  const adAccountUsage = parseAdAccountUsage(headers.get('X-Ad-Account-Usage'));
  const insightsThrottle = parseInsightsThrottle(headers.get('X-FB-Ads-Insights-Throttle'));
  const businessUseCase = parseBusinessUseCase(headers.get('X-Business-Use-Case'));
  
  return {
    adAccountUtilPct: adAccountUsage.adAccountUtilPct ?? null,
    appUtilPct: insightsThrottle.appUtilPct ?? null,
    accIdUtilPct: insightsThrottle.accIdUtilPct ?? null,
    resetTimeDuration: adAccountUsage.resetTimeDuration ?? null,
    estimatedTimeToRegainAccess: businessUseCase.estimatedTimeToRegainAccess ?? null,
    adsApiAccessTier: adAccountUsage.adsApiAccessTier ?? insightsThrottle.adsApiAccessTier ?? null,
  };
}

/**
 * Determine if we should back off based on rate limit info
 * Returns recommended wait time in milliseconds, or 0 if no backoff needed
 */
export function shouldBackoff(info: ParsedRateLimitInfo, thresholdPct = 80): number {
  // If any utilization is above threshold, recommend backoff
  const maxUtil = Math.max(
    info.adAccountUtilPct ?? 0,
    info.appUtilPct ?? 0,
    info.accIdUtilPct ?? 0
  );
  
  if (maxUtil >= thresholdPct) {
    // Use estimated time from header if available, otherwise use reset duration
    const waitMs = info.estimatedTimeToRegainAccess 
      ? info.estimatedTimeToRegainAccess * 1000
      : (info.resetTimeDuration ?? 60) * 1000;
    
    return Math.min(waitMs, 300000); // Cap at 5 minutes
  }
  
  return 0;
}

/**
 * Check if error code indicates rate limiting
 * Error codes: 4 (app throttled), 17/613 (ad account throttled)
 */
export function isRateLimitError(status: number, errorCode?: number): boolean {
  if (status === 429) return true;
  if (status === 613) return true;
  if (errorCode === 4) return true; // Application request limit reached
  if (errorCode === 17) return true; // User request limit reached
  if (errorCode === 613) return true; // Too many calls from this ad-account
  return false;
}



