'use client';

import { useState } from 'react';
import { Trash2, RefreshCw, ExternalLink, TrendingUp, AlertTriangle, Calendar, BarChart2, ArrowRight, PlusCircle, Minus, Activity, TrendingDown, ArrowLeft } from 'lucide-react';
import CredibilityBadge from './credibility-badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface TimelineEvent {
    id: string;
    date: string;
    summary: string;
    articles: any[];
    credibilityScore: number;
    prediction: string;
    sentiment: 'positive' | 'neutral' | 'negative';
    trends?: {
        past: 'scadere' | 'stabil' | 'crestere';
        present: 'scadere' | 'strangere' | 'sus' | 'activ' | 'stabil';
        future: 'scadere' | 'stabil' | 'crestere' | 'incert';
    };
}

interface TrackedTopic {
    id: string;
    keyword: string;
    domain?: string;
    lastUpdated: string;
    history: TimelineEvent[];
}

interface TimelineViewProps {
    topic: TrackedTopic;
    onDelete: (id: string) => void;
    onUpdate: (id: string) => Promise<void>;
    onAnalyze: (article: any) => void;
    onBack?: () => void;
}

const getTrendLabel = (trend: string) => {
    switch (trend) {
        case 'scadere': return 'Scădere';
        case 'stabil': return 'Stabil';
        case 'crestere': return 'Creștere';
        case 'strangere': return 'Strângere';
        case 'sus': return 'Sus';
        case 'activ': return 'Activ';
        case 'incert': return 'Incert';
        default: return trend;
    }
};

const getTrendColor = (trend: string) => {
    switch (trend) {
        case 'scadere': return 'text-red-400';
        case 'crestere': return 'text-green-400';
        case 'sus': return 'text-green-400';
        case 'activ': return 'text-yellow-400';
        case 'strangere': return 'text-orange-400';
        default: return 'text-slate-300';
    }
};

const getTrendIcon = (trend: string) => {
    switch (trend) {
        case 'scadere': return <TrendingDown className="h-3 w-3" />;
        case 'crestere': return <TrendingUp className="h-3 w-3" />;
        case 'sus': return <TrendingUp className="h-3 w-3" />;
        case 'activ': return <Activity className="h-3 w-3" />;
        case 'strangere': return <AlertTriangle className="h-3 w-3" />;
        default: return <Minus className="h-3 w-3" />;
    }
};

export default function TimelineView({ topic, onDelete, onUpdate, onAnalyze, onBack }: TimelineViewProps) {
    const [isUpdating, setIsUpdating] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [activeTab, setActiveTab] = useState<'timeline' | 'evolution'>('timeline');

    const handleUpdate = async () => {
        setIsUpdating(true);
        await onUpdate(topic.id);
        setIsUpdating(false);
    };

    const handleDelete = () => {
        setShowDeleteConfirm(true);
    };

    const confirmDelete = () => {
        onDelete(topic.id);
        setShowDeleteConfirm(false);
    };

    // Prepare data for graph
    const graphData = [...topic.history].reverse().map(event => ({
        date: new Date(event.date).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' }),
        credibility: event.credibilityScore,
        sentimentVal: event.sentiment === 'positive' ? 100 : event.sentiment === 'neutral' ? 50 : 0
    }));

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="mb-4 border-b border-slate-100 pb-4">
                <div className="flex flex-col gap-4 mb-4">
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                            {onBack && (
                                <button
                                    onClick={onBack}
                                    className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-slate-900"
                                    aria-label="Înapoi la listă"
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                </button>
                            )}
                            <div>
                                {topic.domain && (
                                    <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 mb-1">
                                        {topic.domain}
                                    </span>
                                )}
                                <h2 className="text-2xl font-bold text-slate-900 capitalize leading-none">{topic.keyword}</h2>
                            </div>
                        </div>

                        <div className="flex items-start gap-2">
                            <div className="flex flex-col items-end">
                                <button
                                    onClick={handleUpdate}
                                    disabled={isUpdating}
                                    className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                >
                                    <RefreshCw className={`h-4 w-4 ${isUpdating ? 'animate-spin' : ''}`} />
                                    Actualizează
                                </button>
                                <span className="mt-1 text-[10px] text-slate-400 text-right">
                                    Actualizat:<br />
                                    {new Date(topic.lastUpdated).toLocaleString('ro-RO', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-slate-50 p-1 rounded-lg w-fit">
                    <button
                        onClick={() => setActiveTab('timeline')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'timeline'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                            }`}
                    >
                        <Calendar className="h-4 w-4" />
                        Cronologie
                    </button>
                    <button
                        onClick={() => setActiveTab('evolution')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'evolution'
                            ? 'bg-white text-violet-700 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                            }`}
                    >
                        <BarChart2 className="h-4 w-4" />
                        Evoluție
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto pr-2">
                {activeTab === 'evolution' ? (
                    <div className="h-[400px] w-full bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-900 mb-6">Evoluție Credibilitate & Sentiment</h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={graphData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                                <YAxis stroke="#64748b" fontSize={12} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Line type="monotone" dataKey="credibility" name="Credibilitate" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
                                <Line type="monotone" dataKey="sentimentVal" name="Sentiment (0-100)" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="relative space-y-8 pl-4 before:absolute before:bottom-0 before:left-[19px] before:top-2 before:w-0.5 before:bg-slate-200">
                        {topic.history.length === 0 ? (
                            <div className="py-12 text-center text-slate-500">
                                Nu există încă date în istoric. Apasă "Actualizează" pentru a căuta știri.
                            </div>
                        ) : (
                            topic.history.map((event, index) => (
                                <div key={event.id} className="relative pl-8">
                                    {/* Timeline Dot */}
                                    <div className="absolute left-0 top-2 h-10 w-10 rounded-full border-4 border-white bg-violet-100 flex items-center justify-center shadow-sm z-10">
                                        <Calendar className="h-4 w-4 text-violet-600" />
                                    </div>

                                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md overflow-hidden">
                                        {/* Forecast Status Bar - Moved to Top */}
                                        {event.trends && (
                                            <div className="flex items-center justify-between bg-slate-900 p-3 text-white">
                                                <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
                                                    <div className="flex flex-col min-w-fit">
                                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider">Trecut</span>
                                                        <div className={`flex items-center gap-1 ${getTrendColor(event.trends.past)}`}>
                                                            {getTrendIcon(event.trends.past)}
                                                            <span className="text-xs capitalize">{getTrendLabel(event.trends.past)}</span>
                                                        </div>
                                                    </div>
                                                    <div className="h-8 w-px bg-slate-700 shrink-0"></div>
                                                    <div className="flex flex-col min-w-fit">
                                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider">Prezent</span>
                                                        <div className={`flex items-center gap-1 font-medium ${getTrendColor(event.trends.present)}`}>
                                                            {getTrendIcon(event.trends.present)}
                                                            <span className="text-xs capitalize">{getTrendLabel(event.trends.present)}</span>
                                                        </div>
                                                    </div>
                                                    <div className="h-8 w-px bg-slate-700 shrink-0"></div>
                                                    <div className="flex flex-col min-w-fit">
                                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider">Viitor</span>
                                                        <div className={`flex items-center gap-1 font-medium ${getTrendColor(event.trends.future)}`}>
                                                            {getTrendIcon(event.trends.future)}
                                                            <span className="text-xs capitalize">{getTrendLabel(event.trends.future)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button className="text-xs font-medium text-violet-300 hover:text-white transition flex items-center gap-1 shrink-0 ml-2">
                                                    Detalii <ArrowRight className="h-3 w-3" />
                                                </button>
                                            </div>
                                        )}

                                        <div className="p-5">
                                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                                <span className="text-sm font-medium text-slate-500">
                                                    {new Date(event.date).toLocaleDateString('ro-RO', {
                                                        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                                    })}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <CredibilityBadge credibility={{ score: event.credibilityScore, level: event.credibilityScore > 80 ? 'high' : 'medium', factors: { sourceReliability: 0, factualAccuracy: 0, biasDetection: 0 }, highlights: [], summary: '' }} compact />
                                                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${event.sentiment === 'positive' ? 'bg-green-100 text-green-700' :
                                                        event.sentiment === 'negative' ? 'bg-red-100 text-red-700' :
                                                            'bg-slate-100 text-slate-700'
                                                        }`}>
                                                        {event.sentiment === 'positive' ? 'Pozitiv' : event.sentiment === 'negative' ? 'Negativ' : 'Neutru'}
                                                    </span>
                                                </div>
                                            </div>

                                            <p className="mb-4 text-slate-700 leading-relaxed">
                                                {event.summary}
                                            </p>

                                            {/* Prediction Box */}
                                            <div className="mb-4 rounded-xl bg-gradient-to-r from-violet-50 to-indigo-50 p-4 border border-violet-100">
                                                <div className="flex items-start gap-3">
                                                    <TrendingUp className="h-5 w-5 text-violet-600 mt-0.5 shrink-0" />
                                                    <div>
                                                        <h4 className="text-sm font-bold text-violet-900 mb-1">Prognoză AI</h4>
                                                        <p className="text-sm text-violet-800">{event.prediction}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Sources */}
                                            <div className="border-t border-slate-100 pt-3">
                                                <p className="mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Surse analizate</p>
                                                <div className="space-y-3">
                                                    {event.articles.map((article: any) => (
                                                        <div key={article.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 hover:bg-slate-100 transition">
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium text-slate-900 leading-snug mb-1">{article.title}</p>
                                                                <p className="text-xs text-slate-500">{article.source} • {new Date(article.publishedAt).toLocaleDateString()}</p>
                                                            </div>
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <button
                                                                    onClick={() => onAnalyze(article)}
                                                                    className="flex items-center gap-1.5 rounded-md bg-white border border-violet-200 px-2.5 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-50 transition shadow-sm"
                                                                    title="Adaugă la fluxul de analiză"
                                                                >
                                                                    <PlusCircle className="h-3.5 w-3.5" />
                                                                    Analizează
                                                                </button>
                                                                <a
                                                                    href={article.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center gap-1.5 rounded-md bg-white border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition shadow-sm"
                                                                >
                                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                                    Sursă
                                                                </a>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 mx-auto">
                            <AlertTriangle className="h-6 w-6" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 text-center mb-2">Ștergi acest subiect?</h3>
                        <p className="text-center text-slate-600 mb-6">
                            Atenție! Ștergerea acestui subiect va elimina permanent întregul istoric de urmărire și analizele asociate. Această acțiune este ireversibilă.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 rounded-xl border border-slate-200 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
                            >
                                Anulează
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 rounded-xl bg-red-600 py-2.5 font-medium text-white hover:bg-red-700"
                            >
                                Șterge definitiv
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
