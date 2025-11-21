import { NextRequest, NextResponse } from 'next/server';
import { updateTopicAnalysis, getTrackedTopicById } from '@/lib/tracking-service';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { id } = body;

        if (!id) {
            return NextResponse.json({ error: 'Topic ID is required' }, { status: 400 });
        }

        const topic = getTrackedTopicById(id);
        if (!topic) {
            return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
        }

        const updatedTopic = await updateTopicAnalysis(id);

        return NextResponse.json(updatedTopic);
    } catch (error) {
        console.error('Error updating topic analysis:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
