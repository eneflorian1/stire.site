import { NextRequest, NextResponse } from 'next/server';
import { getGeminiState, runGeminiAction, updateGeminiApiKey } from '@/lib/gemini';

export async function GET() {
  try {
    const state = await getGeminiState();
    return NextResponse.json({ state });
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
    } else {
      return NextResponse.json({ error: 'Payload invalid.' }, { status: 400 });
    }
    return NextResponse.json({ state });
  } catch (error) {
    console.error('/api/gemini POST error', error);
    return NextResponse.json({ error: 'Nu am putut actualiza Gemini.' }, { status: 500 });
  }
}
