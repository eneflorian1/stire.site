import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { externalSearchService, ExternalArticle } from './external-search';
import { createAIService } from './ai-service';
import { getAIConfig } from './ai-config';

export interface TimelineEvent {
    id: string;
    date: string;
    summary: string;
    articles: ExternalArticle[];
    credibilityScore: number; // 0-100
    prediction: string;
    sentiment: 'positive' | 'neutral' | 'negative';
    trends?: {
        past: 'scadere' | 'stabil' | 'crestere';
        present: 'scadere' | 'strangere' | 'sus' | 'activ' | 'stabil';
        future: 'scadere' | 'stabil' | 'crestere' | 'incert';
    };
}

export interface TrackedTopic {
    id: string;
    keyword: string;
    domain?: string;
    createdAt: string;
    lastUpdated: string;
    history: TimelineEvent[];
    status: 'active' | 'paused';
}

const DATA_DIR = path.join(process.cwd(), 'data');
const TOPICS_FILE = path.join(DATA_DIR, 'tracked-topics.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize topics file if it doesn't exist
if (!fs.existsSync(TOPICS_FILE)) {
    fs.writeFileSync(TOPICS_FILE, JSON.stringify([], null, 2));
}

function getTopics(): TrackedTopic[] {
    try {
        const data = fs.readFileSync(TOPICS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading tracked topics:', error);
        return [];
    }
}

function saveTopics(topics: TrackedTopic[]): void {
    fs.writeFileSync(TOPICS_FILE, JSON.stringify(topics, null, 2));
}

export function getAllTrackedTopics(): TrackedTopic[] {
    return getTopics().sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
}

export function getTrackedTopicById(id: string): TrackedTopic | null {
    const topics = getTopics();
    return topics.find(t => t.id === id) || null;
}

export function createTrackedTopic(keyword: string, domain?: string): TrackedTopic {
    const topics = getTopics();

    const newTopic: TrackedTopic = {
        id: randomUUID(),
        keyword,
        domain,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        history: [],
        status: 'active'
    };

    topics.push(newTopic);
    saveTopics(topics);

    return newTopic;
}

export function deleteTrackedTopic(id: string): boolean {
    const topics = getTopics();
    const filtered = topics.filter(t => t.id !== id);

    if (filtered.length === topics.length) {
        return false;
    }

    saveTopics(filtered);
    return true;
}

export async function updateTopicAnalysis(topicId: string): Promise<TrackedTopic | null> {
    const topics = getTopics();
    const topicIndex = topics.findIndex(t => t.id === topicId);

    if (topicIndex === -1) return null;

    const topic = topics[topicIndex];

    // 1. Search for new articles
    const articles = await externalSearchService.search(topic.keyword, topic.domain);

    // Filter by date (max 3 days old)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const recentArticles = articles.filter(a => {
        const pubDate = new Date(a.publishedAt);
        return pubDate >= threeDaysAgo;
    });

    // Filter out articles already in history (simple check by URL)
    const existingUrls = new Set(topic.history.flatMap(h => h.articles.map(a => a.url)));
    const newArticles = recentArticles.filter(a => !existingUrls.has(a.url));

    if (newArticles.length === 0) {
        // No new articles, but update timestamp to show we checked
        topic.lastUpdated = new Date().toISOString();
        topics[topicIndex] = topic;
        saveTopics(topics);
        return topic;
    }

    // 2. Analyze with AI
    const analysis = await analyzeForTimeline(topic.keyword, newArticles, topic.history);

    const newEvent: TimelineEvent = {
        id: randomUUID(),
        date: new Date().toISOString(),
        articles: newArticles,
        summary: analysis.summary,
        credibilityScore: analysis.credibilityScore,
        prediction: analysis.prediction,
        sentiment: analysis.sentiment,
        trends: analysis.trends
    };

    // 3. Update topic
    topic.history.unshift(newEvent); // Add to beginning
    topic.lastUpdated = new Date().toISOString();

    topics[topicIndex] = topic;
    saveTopics(topics);

    return topic;
}

// Helper to simulate AI analysis (replace with real AI call later)
async function analyzeForTimeline(keyword: string, articles: ExternalArticle[], history: TimelineEvent[]) {
    const config = getAIConfig();

    // Default mock response if no AI config
    const mockResponse = {
        summary: `Au apărut ${articles.length} articole noi despre "${keyword}". Se observă o tendință de creștere a interesului pentru acest subiect.`,
        credibilityScore: Math.floor(Math.random() * 20) + 70, // 70-90
        prediction: `Pe baza acestor informații, este probabil ca în următoarele zile să vedem o reacție a pieței sau noi declarații oficiale legate de ${keyword}.`,
        sentiment: Math.random() > 0.5 ? 'positive' : 'neutral' as 'positive' | 'neutral' | 'negative',
        trends: {
            past: 'stabil' as const,
            present: 'activ' as const,
            future: 'crestere' as const
        }
    };

    if (!config) return mockResponse;

    try {
        const aiService = createAIService(config);

        const articlesText = articles.map(a => `- ${a.title}: ${a.snippet} (${a.source})`).join('\n');
        const historyText = history.slice(0, 3).map(h => `- ${h.date}: ${h.summary}`).join('\n');

        const prompt = `Analyze these new articles about "${keyword}" in the context of previous events.
    
    New Articles:
    ${articlesText}
    
    Previous Context:
    ${historyText}
    
    Return ONLY a JSON object with this structure:
    {
      "summary": "Concise summary of the new developments (max 2 sentences) in Romanian.",
      "credibilityScore": <number 0-100 based on source reliability>,
      "prediction": "Short prediction of what might happen next based on this news (in Romanian).",
      "sentiment": "<positive|neutral|negative>",
      "trends": {
        "past": "<scadere|stabil|crestere>",
        "present": "<scadere|strangere|sus|activ|stabil>",
        "future": "<scadere|stabil|crestere|incert>"
      }
    }`;

        const responseText = await aiService.generateContent(prompt);
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
    } catch (error) {
        console.error('AI Analysis failed:', error);
    }

    return mockResponse;
}
