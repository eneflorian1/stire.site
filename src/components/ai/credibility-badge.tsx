'use client';

import type { CredibilityResult } from '@/lib/ai-config';

type Props = {
    credibility: CredibilityResult;
    compact?: boolean;
};

const CredibilityBadge = ({ credibility, compact = false }: Props) => {
    const { score, level, factors, summary } = credibility;

    const getColor = () => {
        if (level === 'high') return 'bg-green-500';
        if (level === 'medium') return 'bg-yellow-500';
        return 'bg-red-500';
    };

    const getTextColor = () => {
        if (level === 'high') return 'text-green-700';
        if (level === 'medium') return 'text-yellow-700';
        return 'text-red-700';
    };

    const getBgColor = () => {
        if (level === 'high') return 'bg-green-50';
        if (level === 'medium') return 'bg-yellow-50';
        return 'bg-red-50';
    };

    const getLabel = () => {
        if (level === 'high') return 'Credibilitate Ridicată';
        if (level === 'medium') return 'Credibilitate Medie';
        return 'Credibilitate Scăzută';
    };

    if (compact) {
        return (
            <div className={`flex items-center gap-2 rounded-lg border ${getBgColor()} px-2 py-1`}>
                <div className={`h-2 w-2 rounded-full ${getColor()}`} />
                <span className={`text-xs font-semibold ${getTextColor()}`}>
                    {score}/100
                </span>
            </div>
        );
    }

    return (
        <div className={`rounded-xl border ${getBgColor()} p-4`}>
            <div className="mb-3 flex items-center gap-3">
                <div className={`h-3 w-3 rounded-full ${getColor()}`} />
                <div>
                    <div className={`text-sm font-semibold ${getTextColor()}`}>
                        {getLabel()}
                    </div>
                    <div className="text-2xl font-bold text-slate-900">{score}/100</div>
                </div>
            </div>

            <p className="mb-3 text-sm text-slate-600">{summary}</p>

            <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Fiabilitate sursă</span>
                    <span className="font-medium text-slate-900">{factors.sourceReliability}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                        className={`h-full ${getColor()}`}
                        style={{ width: `${factors.sourceReliability}%` }}
                    />
                </div>

                <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Acuratețe factuală</span>
                    <span className="font-medium text-slate-900">{factors.factualAccuracy}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                        className={`h-full ${getColor()}`}
                        style={{ width: `${factors.factualAccuracy}%` }}
                    />
                </div>

                <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Detecție bias</span>
                    <span className="font-medium text-slate-900">{factors.biasDetection}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                        className={`h-full ${getColor()}`}
                        style={{ width: `${factors.biasDetection}%` }}
                    />
                </div>
            </div>
        </div>
    );
};

export default CredibilityBadge;
