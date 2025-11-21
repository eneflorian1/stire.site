import { NextRequest, NextResponse } from 'next/server';
import {
  deleteGeminiArticleLogs,
  getGeminiState,
  runGeminiAction,
  updateGeminiApiKey,
  updateGeminiConfig,
  initGeminiLoop,
} from '@/lib/gemini';

// Initializam loop-ul daca e cazul (server restart)
initGeminiLoop().catch(console.error);

export async function GET() {
  try {
    const state = await getGeminiState();
    const serverStartedAt = new Date(Date.now() - process.uptime() * 1000).toISOString();
    return NextResponse.json({ state, serverStartedAt });
  } catch (error) {
    console.error('/api/gemini GET error', error);
    return NextResponse.json({ error: 'Nu am putut incarca starea Gemini.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    let state;
    if (typeof payload?.apiKey === 'string') {
      state = await updateGeminiApiKey(payload.apiKey);
    } else if (payload?.action && ['start', 'stop', 'reset'].includes(payload.action)) {
      state = await runGeminiAction(payload.action);
    } else if (payload?.action === 'config') {
      state = await updateGeminiConfig({
        useManualTopics: payload?.useManualTopics,
        useTrendTopics: payload?.useTrendTopics,
      });
    } else if (payload?.action === 'deleteLogs') {
      const ids =
        Array.isArray(payload?.ids) && payload.ids.length > 0
          ? payload.ids.filter((id: unknown): id is string => typeof id === 'string')
          : undefined;
      state = await deleteGeminiArticleLogs(ids);
    } else {
      return NextResponse.json({ error: 'Payload invalid.' }, { status: 400 });
    }
    const serverStartedAt = new Date(Date.now() - process.uptime() * 1000).toISOString();
    return NextResponse.json({ state, serverStartedAt });
  } catch (error) {
    console.error('/api/gemini POST error', error);
    return NextResponse.json({ error: 'Nu am putut actualiza Gemini.' }, { status: 500 });
  }
}
