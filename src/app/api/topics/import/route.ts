import { NextRequest, NextResponse } from 'next/server';
import { getTopics, type Topic } from '@/lib/topics';
import { randomUUID } from 'crypto';

const writeTopics = async (topics: Topic[]) => {
  const fs = require('fs/promises');
  const path = require('path');
  const DATA_PATH = path.join(process.cwd(), 'data', 'topics.json');
  await fs.writeFile(DATA_PATH, JSON.stringify(topics, null, 2));
};

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const titles = payload?.titles;

    if (!Array.isArray(titles) || titles.length === 0) {
      return NextResponse.json({ error: 'Nu s-au primit topicuri valide.' }, { status: 400 });
    }

    const topics = await getTopics();
    const newTopics: Topic[] = [];

    for (const label of titles) {
      if (!label || typeof label !== 'string') continue;
      const trimmedLabel = label.trim();
      if (!trimmedLabel) continue;

      // Skip if already exists
      if (topics.some((topic) => topic.label.toLowerCase() === trimmedLabel.toLowerCase())) {
        continue;
      }

      const topic: Topic = {
        id: randomUUID(),
        label: trimmedLabel,
        source: 'trend',
        createdAt: new Date().toISOString(),
      };
      topics.unshift(topic);
      newTopics.push(topic);
    }

    // Save updated topics
    await writeTopics(topics);

    return NextResponse.json({ imported: newTopics });
  } catch (error) {
    console.error('/api/topics/import POST error', error);
    return NextResponse.json(
      { error: 'Nu am putut importa topicurile.' },
      { status: 500 }
    );
  }
}
