import { cookies, headers } from "next/headers";
import type { NextRequest } from "next/server";
import jwt, { type JwtPayload } from "jsonwebtoken";

const AUTHORIZATION_HEADER = "authorization";
const ACCOUNT_ID_HEADER = "x-account-id";
const DEFAULT_AUTH_COOKIE_NAME = "dashboard_token";

const DEV_ACCOUNT_FALLBACK =
  process.env.LOCAL_DEV_ACCOUNT_ID ?? process.env.DEFAULT_ACCOUNT_ID ?? null;

type CookieStore = Awaited<ReturnType<typeof cookies>>;

interface AccountClaims extends JwtPayload {
  account_id?: string;
  accountId?: string;
  user_id?: string;
  userId?: string;
}

export interface AccountAuthContext {
  accountId: string;
  userId?: string;
}

function getAuthCookieName(): string {
  return process.env.AUTH_JWT_COOKIE_NAME ?? DEFAULT_AUTH_COOKIE_NAME;
}

function parseBearerToken(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return trimmed.substring(7).trim() || null;
}

function decodeJwt(token: string | null): AccountClaims | null {
  if (!token) {
    return null;
  }

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      "JWT_SECRET is not configured. Unable to decode authentication token."
    );
  }

  try {
    const decoded = jwt.verify(token, secret);
    if (typeof decoded === "string") {
      return null;
    }
    return decoded as AccountClaims;
  } catch (error) {
    console.warn("Failed to decode JWT", error);
    return null;
  }
}

function buildContextFromClaims(claims: AccountClaims | null): AccountAuthContext | null {
  if (!claims) {
    return null;
  }

  const accountId = claims.account_id ?? claims.accountId;

  if (typeof accountId !== "string" || accountId.length === 0) {
    return null;
  }

  const userId = claims.user_id ?? claims.userId;

  return {
    accountId,
    userId: typeof userId === "string" ? userId : undefined,
  };
}

function contextFromHeaders(headerList: Headers): AccountAuthContext | null {
  const directAccountId = headerList.get(ACCOUNT_ID_HEADER);
  if (directAccountId) {
    return { accountId: directAccountId };
  }

  const authHeader =
    headerList.get(AUTHORIZATION_HEADER) ??
    headerList.get(AUTHORIZATION_HEADER.toUpperCase());

  const token = parseBearerToken(authHeader);
  return buildContextFromClaims(decodeJwt(token));
}

function contextFromCookies(cookieStore: CookieStore): AccountAuthContext | null {
  const token = cookieStore.get(getAuthCookieName())?.value ?? null;
  return buildContextFromClaims(decodeJwt(token));
}

function devFallbackContext(): AccountAuthContext | null {
  if (!DEV_ACCOUNT_FALLBACK) {
    return null;
  }

  return { accountId: DEV_ACCOUNT_FALLBACK };
}

function resolveAccountContextFromRequest(
  request: NextRequest | null
): AccountAuthContext | null {
  if (request) {
    const headerContext = contextFromHeaders(request.headers);
    if (headerContext) {
      return headerContext;
    }

    const cookieToken = request.cookies.get(getAuthCookieName())?.value ?? null;
    const cookieContext = buildContextFromClaims(decodeJwt(cookieToken));
    if (cookieContext) {
      return cookieContext;
    }
  }

  return null;
}

export async function getOptionalAccountContext(): Promise<AccountAuthContext | null> {
  const headerList = await headers();
  const headerContext = contextFromHeaders(headerList);
  if (headerContext) {
    return headerContext;
  }

  const cookieStore = await cookies();
  const cookieContext = contextFromCookies(cookieStore);
  if (cookieContext) {
    return cookieContext;
  }

  return devFallbackContext();
}

export async function requireAccountContext(): Promise<AccountAuthContext> {
  const context = await getOptionalAccountContext();

  if (!context) {
    throw new Error("Unable to determine account context for the request.");
  }

  return context;
}

export function requireAccountContextFromRequest(
  request: NextRequest
): AccountAuthContext {
  const requestContext = resolveAccountContextFromRequest(request);
  if (requestContext) {
    return requestContext;
  }

  const fallback = devFallbackContext();
  if (fallback) {
    return fallback;
  }

  throw new Error("Missing authentication context on the incoming request.");
}

export async function requireAccountId(): Promise<string> {
  const context = await requireAccountContext();
  return context.accountId;
}

export function requireAccountIdFromRequest(request: NextRequest): string {
  return requireAccountContextFromRequest(request).accountId;
}




