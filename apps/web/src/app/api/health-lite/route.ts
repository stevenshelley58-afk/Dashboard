import { NextResponse } from 'next/server';
import { healthCheck } from '@/lib/db';

export async function GET(): Promise<NextResponse> {
  try {
    const timestamp = await healthCheck();
    return NextResponse.json(
      { db: 'ok', checkedAt: timestamp.toISOString() },
      { status: 200 }
    );
  } catch (error) {
    console.error('Health check failed', error);
    return NextResponse.json(
      { db: 'error' },
      {
        status: 500,
      }
    );
  }
}

