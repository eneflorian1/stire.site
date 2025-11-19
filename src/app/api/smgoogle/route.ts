import { NextRequest, NextResponse } from 'next/server';
import { getSMGoogleLogs, submitManualSMGoogle } from '@/lib/smgoogle';

export async function GET() {
  try {
    const logs = await getSMGoogleLogs();
    const uniqueLinks = Array.from(new Map(logs.map((log) => [log.url, log])).values()).map(
      (log) => ({
        url: log.url,
        lastStatus: log.status,
        createdAt: log.createdAt,
      })
    );
    return NextResponse.json({ logs, links: uniqueLinks });
  } catch (error) {
    console.error('/api/smgoogle GET error', error);
    return NextResponse.json(
      { error: 'Nu am putut incarca logurile Google Indexing.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const url = typeof payload?.url === 'string' ? payload.url.trim() : '';
    if (!url) {
      return NextResponse.json({ error: 'Introdu URL-ul de trimis.' }, { status: 400 });
    }
    const result = await submitManualSMGoogle(url);
    return NextResponse.json(result);
  } catch (error) {
    console.error('/api/smgoogle POST error', error);
    return NextResponse.json(
      { error: 'Nu am putut trimite URL-ul catre Google.' },
      { status: 500 }
    );
  }
}
