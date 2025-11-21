import { NextRequest, NextResponse } from 'next/server';
import {
    getAllTrackedTopics,
    createTrackedTopic,
    deleteTrackedTopic,
    updateTopicAnalysis
} from '@/lib/tracking-service';

export async function GET() {
    const topics = getAllTrackedTopics();
    return NextResponse.json(topics);
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { keyword, domain } = body;

        if (!keyword) {
            return NextResponse.json({ error: 'Keyword is required' }, { status: 400 });
        }

        const topic = createTrackedTopic(keyword, domain);

        // Trigger initial analysis in background (or await if fast enough)
        // For prototype, we await to show immediate results
        await updateTopicAnalysis(topic.id);

        // Re-fetch to get the updated history
        const updatedTopic = getAllTrackedTopics().find(t => t.id === topic.id);

        return NextResponse.json(updatedTopic);
    } catch (error) {
        console.error('Error creating tracked topic:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        const success = deleteTrackedTopic(id);

        if (!success) {
            return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting tracked topic:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
