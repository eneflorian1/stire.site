'use client';

import { ExternalLink } from 'lucide-react';
import type { Recommendation } from '@/lib/ai-config';

type Props = {
    recommendations: Recommendation[];
};

const RecommendationsSection = ({ recommendations }: Props) => {
    if (recommendations.length === 0) {
        return null;
    }

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'article':
                return '📰';
            case 'tutorial':
                return '📚';
            case 'video':
                return '🎥';
            case 'resource':
                return '🔗';
            default:
                return '📄';
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'article':
                return 'Articol';
            case 'tutorial':
                return 'Tutorial';
            case 'video':
                return 'Video';
            case 'resource':
                return 'Resursă';
            default:
                return 'Link';
        }
    };

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
                Recomandări personalizate
            </h2>
            <p className="mb-6 text-sm text-slate-600">
                Pe baza articolelor tale salvate și a topicurilor selectate
            </p>

            <div className="space-y-4">
                {recommendations.map((rec, index) => (
                    <a
                        key={index}
                        href={rec.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block rounded-xl border border-slate-200 p-4 transition hover:border-violet-300 hover:bg-violet-50/50"
                    >
                        <div className="mb-2 flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                                <span className="text-2xl">{getTypeIcon(rec.type)}</span>
                                <div className="flex-1">
                                    <div className="mb-1 flex items-center gap-2">
                                        <span className="text-xs font-medium text-violet-600">
                                            {getTypeLabel(rec.type)}
                                        </span>
                                        {rec.source && (
                                            <span className="text-xs text-slate-500">• {rec.source}</span>
                                        )}
                                    </div>
                                    <h3 className="font-semibold text-slate-900 group-hover:text-violet-700">
                                        {rec.title}
                                    </h3>
                                </div>
                            </div>
                            <ExternalLink className="h-4 w-4 flex-shrink-0 text-slate-400 group-hover:text-violet-600" />
                        </div>

                        <p className="mb-2 text-sm text-slate-600">{rec.description}</p>

                        <div className="flex items-center justify-between">
                            <p className="text-xs italic text-slate-500">
                                💡 {rec.reason}
                            </p>
                            <div className="flex items-center gap-1.5">
                                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
                                    <div
                                        className="h-full bg-violet-500"
                                        style={{ width: `${rec.relevanceScore}%` }}
                                    />
                                </div>
                                <span className="text-xs font-medium text-slate-600">
                                    {rec.relevanceScore}%
                                </span>
                            </div>
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
};

export default RecommendationsSection;
