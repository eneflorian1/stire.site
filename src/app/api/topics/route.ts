import { NextRequest, NextResponse } from 'next/server';
import { addManualTopic, deleteTopicsByIds, getTopics } from '@/lib/topics';

export async function GET() {
  try {
    const topics = await getTopics();
    return NextResponse.json({ topics });
  } catch (error) {
    console.error('/api/topics GET error', error);
    return NextResponse.json({ error: 'Nu am putut incarca topicurile.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const label = typeof payload?.label === 'string' ? payload.label.trim() : '';
    if (!label) {
      return NextResponse.json({ error: 'Introdu un topic valid.' }, { status: 400 });
    }
    const topic = await addManualTopic(label);
    return NextResponse.json({ topic });
  } catch (error) {
    console.error('/api/topics POST error', error);
    return NextResponse.json({ error: 'Nu am putut salva topicul.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => null);
    const ids: string[] = Array.isArray(payload?.ids) ? payload.ids : [];
    if (!ids.length) {
      return NextResponse.json({ error: 'Nu s-au furnizat topicuri de sters.' }, { status: 400 });
    }
    const result = await deleteTopicsByIds(ids);
    return NextResponse.json(result);
  } catch (error) {
    console.error('/api/topics DELETE error', error);
    return NextResponse.json(
      { error: 'Nu am putut sterge topicurile.' },
      { status: 500 }
    );
  }
}
