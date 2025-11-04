/** HTTP client with rate limiting, retry logic, and error handling */
import { logger } from './logger.js';

const log = logger('http-client');

export interface HttpClientOptions {
  baseURL?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  rateLimitRpm?: number; // Requests per minute
  headers?: Record<string, string>;
}

export interface RateLimiter {
  requests: number[];
  rpm: number;
}

export class HttpClient {
  private baseURL?: string;
  private timeout: number;
  private retries: number;
  private retryDelay: number;
  private rateLimiters: Map<string, RateLimiter> = new Map();
  private defaultHeaders: Record<string, string>;

  constructor(options: HttpClientOptions = {}) {
    this.baseURL = options.baseURL;
    this.timeout = options.timeout || 30000;
    this.retries = options.retries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.defaultHeaders = options.headers || {};

    if (options.rateLimitRpm) {
      this.setRateLimit('default', options.rateLimitRpm);
    }
  }

  setRateLimit(key: string, rpm: number): void {
    this.rateLimiters.set(key, { requests: [], rpm });
  }

  private async waitForRateLimit(key: string): Promise<void> {
    const limiter = this.rateLimiters.get(key);
    if (!limiter) return;

    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Remove requests older than 1 minute
    limiter.requests = limiter.requests.filter((time) => time > oneMinuteAgo);

    // If we're at the limit, wait
    if (limiter.requests.length >= limiter.rpm) {
      const oldestRequest = limiter.requests[0];
      const waitTime = 60000 - (now - oldestRequest) + 100; // Add 100ms buffer
      log.debug(`Rate limit reached, waiting ${waitTime}ms`);
      await this.sleep(waitTime);
      return this.waitForRateLimit(key);
    }

    // Record this request
    limiter.requests.push(now);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async request<T>(
    method: string,
    url: string,
    options: {
      body?: unknown;
      headers?: Record<string, string>;
      rateLimitKey?: string;
      timeout?: number;
    } = {}
  ): Promise<T> {
    const fullUrl = this.baseURL ? `${this.baseURL}${url}` : url;
    const rateLimitKey = options.rateLimitKey || 'default';

    // Wait for rate limit if configured
    if (this.rateLimiters.has(rateLimitKey)) {
      await this.waitForRateLimit(rateLimitKey);
    }

    const headers = {
      'Content-Type': 'application/json',
      ...this.defaultHeaders,
      ...options.headers,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      options.timeout || this.timeout
    );

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          log.debug(`Retry attempt ${attempt} after ${delay}ms`);
          await this.sleep(delay);
        }

        const response = await fetch(fullUrl, {
          method,
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new HttpError(
            `HTTP ${response.status}: ${response.statusText}`,
            response.status,
            errorText,
            fullUrl
          );
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return (await response.json()) as T;
        }

        return (await response.text()) as unknown as T;
      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on client errors (4xx) except 429 (rate limit)
        if (
          lastError instanceof HttpError &&
          lastError.status >= 400 &&
          lastError.status < 500 &&
          lastError.status !== 429
        ) {
          throw lastError;
        }

        // Don't retry on abort (timeout)
        if (lastError.name === 'AbortError') {
          throw new Error(`Request timeout after ${this.timeout}ms`);
        }

        if (attempt === this.retries) {
          throw lastError;
        }
      }
    }

    throw lastError || new Error('Request failed');
  }

  async get<T>(url: string, options?: Parameters<HttpClient['request']>[2]): Promise<T> {
    return this.request<T>('GET', url, options);
  }

  async post<T>(url: string, body?: unknown, options?: Parameters<HttpClient['request']>[2]): Promise<T> {
    return this.request<T>('POST', url, { ...options, body });
  }
}

export class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public responseBody?: string,
    public url?: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

