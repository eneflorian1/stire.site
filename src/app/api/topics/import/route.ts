import { NextResponse } from 'next/server';
import { importTrendTopics } from '@/lib/topics';

export async function POST() {
  try {
    const imported = await importTrendTopics();
    return NextResponse.json({ imported });
  } catch (error) {
    console.error('/api/topics/import POST error', error);
    return NextResponse.json(
      { error: 'Nu am putut importa trendurile Google.' },
      { status: 500 }
    );
  }
}
