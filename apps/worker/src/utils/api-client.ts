/** Base API client with authentication and common patterns */
import { HttpClient, HttpError } from './http-client.js';
import { logger } from './logger.js';

const log = logger('api-client');

export interface ApiClientOptions {
  baseURL: string;
  apiKey?: string;
  bearerToken?: string;
  timeout?: number;
  retries?: number;
  rateLimitRpm?: number;
  customHeaders?: Record<string, string>;
}

export abstract class ApiClient {
  protected http: HttpClient;

  constructor(options: ApiClientOptions) {
    const headers: Record<string, string> = { ...options.customHeaders };

    if (options.apiKey) {
      headers['Authorization'] = `Bearer ${options.apiKey}`;
    } else if (options.bearerToken) {
      headers['Authorization'] = `Bearer ${options.bearerToken}`;
    }

    this.http = new HttpClient({
      baseURL: options.baseURL,
      timeout: options.timeout,
      retries: options.retries,
      rateLimitRpm: options.rateLimitRpm,
      headers,
    });
  }

  protected handleError(error: unknown, context: string): never {
    if (error instanceof HttpError) {
      log.error(`${context}: ${error.message} (${error.status})`, {
        url: error.url,
        responseBody: error.responseBody,
      });

      // Map HTTP errors to specific error codes
      if (error.status === 401 || error.status === 403) {
        throw new Error(`${context}_AUTH_ERROR: ${error.message}`);
      }
      if (error.status === 429) {
        throw new Error(`${context}_RATE_LIMIT: ${error.message}`);
      }
      if (error.status >= 500) {
        throw new Error(`${context}_SERVER_ERROR: ${error.message}`);
      }
    }

    const message = error instanceof Error ? error.message : String(error);
    log.error(`${context}: ${message}`);
    throw new Error(`${context}_ERROR: ${message}`);
  }

  protected async paginate<T>(
    fetchFn: (cursor?: string) => Promise<{ data: T[]; nextCursor?: string }>,
    maxPages?: number
  ): Promise<T[]> {
    const allData: T[] = [];
    let cursor: string | undefined;
    let page = 0;

    while (true) {
      if (maxPages && page >= maxPages) break;

      const result = await fetchFn(cursor);
      allData.push(...result.data);

      if (!result.nextCursor) break;

      cursor = result.nextCursor;
      page++;
    }

    return allData;
  }
}

