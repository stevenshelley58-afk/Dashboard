import { NextResponse } from 'next/server';
import { healthCheck } from '@/lib/db';

export async function GET(): Promise<NextResponse> {
  // Debug: Check which env var is being used
  const hasPostgresUrl = !!process.env.POSTGRES_URL;
  const hasDatabaseUrl = !!process.env.DATABASE_URL;
  
  try {
    const timestamp = await healthCheck();
    return NextResponse.json(
      { 
        db: 'ok', 
        checkedAt: timestamp.toISOString(),
        env: { hasPostgresUrl, hasDatabaseUrl }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Health check failed', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        db: 'error', 
        message,
        env: { hasPostgresUrl, hasDatabaseUrl }
      },
      { status: 500 }
    );
  }
}

