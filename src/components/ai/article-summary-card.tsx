'use client';

import { Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { SummaryResult } from '@/lib/ai-config';

type Props = {
    summary: SummaryResult;
    articleTitle: string;
};

const ArticleSummaryCard = ({ summary, articleTitle }: Props) => {
    const { brief, keyPoints, entities, sentiment, readingTime } = summary;

    const getSentimentIcon = () => {
        if (sentiment === 'positive') return <TrendingUp className="h-4 w-4 text-green-600" />;
        if (sentiment === 'negative') return <TrendingDown className="h-4 w-4 text-red-600" />;
        return <Minus className="h-4 w-4 text-slate-600" />;
    };

    const getSentimentColor = () => {
        if (sentiment === 'positive') return 'text-green-600';
        if (sentiment === 'negative') return 'text-red-600';
        return 'text-slate-600';
    };

    const getSentimentLabel = () => {
        if (sentiment === 'positive') return 'Pozitiv';
        if (sentiment === 'negative') return 'Negativ';
        return 'Neutru';
    };

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 font-semibold text-slate-900 line-clamp-2">{articleTitle}</h3>

            <div className="mb-4 flex items-center gap-4 text-xs text-slate-500">
                <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{readingTime} min citire</span>
                </div>
                <div className={`flex items-center gap-1 ${getSentimentColor()}`}>
                    {getSentimentIcon()}
                    <span>{getSentimentLabel()}</span>
                </div>
            </div>

            <div className="mb-4 rounded-lg bg-slate-50 p-3">
                <p className="text-sm text-slate-700">{brief}</p>
            </div>

            {keyPoints.length > 0 && (
                <div className="mb-4">
                    <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">
                        Puncte Cheie
                    </h4>
                    <ul className="space-y-1.5">
                        {keyPoints.map((point, index) => (
                            <li key={index} className="flex gap-2 text-sm text-slate-700">
                                <span className="text-violet-500">•</span>
                                <span>{point}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {entities.length > 0 && (
                <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">
                        Entități Menționate
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {entities.map((entity, index) => (
                            <span
                                key={index}
                                className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700"
                            >
                                {entity.type === 'person' && '👤'}
                                {entity.type === 'organization' && '🏢'}
                                {entity.type === 'location' && '📍'}
                                {entity.type === 'technology' && '💻'}
                                {entity.type === 'concept' && '💡'}
                                {entity.name}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ArticleSummaryCard;
