// AI Topics Configuration
// Separate from the existing topics system used for Gemini article generation

export type AITopic = {
    id: string;
    label: string;
    icon: string;
    color: string;
    keywords: string[]; // Keywords to match in articles
};

export const AI_TOPICS: AITopic[] = [
    {
        id: 'crypto',
        label: 'Crypto',
        icon: '₿',
        color: 'bg-orange-500',
        keywords: ['crypto', 'bitcoin', 'ethereum', 'blockchain', 'cryptocurrency', 'btc', 'eth'],
    },
    {
        id: 'cybersecurity',
        label: 'Cybersecurity',
        icon: '🔒',
        color: 'bg-red-500',
        keywords: ['security', 'cybersecurity', 'hack', 'breach', 'vulnerability', 'malware', 'ransomware'],
    },
    {
        id: 'trading',
        label: 'Trading',
        icon: '📈',
        color: 'bg-green-500',
        keywords: ['trading', 'stocks', 'forex', 'investment', 'market', 'trader'],
    },
    {
        id: 'programming',
        label: 'Programare',
        icon: '💻',
        color: 'bg-blue-500',
        keywords: ['programming', 'code', 'developer', 'software', 'javascript', 'python', 'programare'],
    },
    {
        id: 'ai-ml',
        label: 'AI & ML',
        icon: '🤖',
        color: 'bg-purple-500',
        keywords: ['ai', 'artificial intelligence', 'machine learning', 'ml', 'neural', 'deep learning'],
    },
    {
        id: 'blockchain',
        label: 'Blockchain',
        icon: '⛓️',
        color: 'bg-indigo-500',
        keywords: ['blockchain', 'distributed ledger', 'smart contract', 'web3', 'defi'],
    },
    {
        id: 'web-dev',
        label: 'Web Development',
        icon: '🌐',
        color: 'bg-teal-500',
        keywords: ['web', 'frontend', 'backend', 'react', 'nextjs', 'development', 'html', 'css'],
    },
];

/**
 * Get selected topics from localStorage
 */
export const getSelectedTopics = (): string[] => {
    if (typeof window === 'undefined') return [];

    try {
        const saved = localStorage.getItem('ai-selected-topics');
        if (!saved) return [];
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

/**
 * Save selected topics to localStorage
 */
export const saveSelectedTopics = (topicIds: string[]): void => {
    if (typeof window === 'undefined') return;

    try {
        localStorage.setItem('ai-selected-topics', JSON.stringify(topicIds));
    } catch {
        // Ignore errors
    }
};

/**
 * Toggle a topic selection
 */
export const toggleTopic = (topicId: string): string[] => {
    const selected = getSelectedTopics();
    const index = selected.indexOf(topicId);

    let newSelected: string[];
    if (index > -1) {
        // Remove
        newSelected = selected.filter(id => id !== topicId);
    } else {
        // Add
        newSelected = [...selected, topicId];
    }

    saveSelectedTopics(newSelected);
    return newSelected;
};
