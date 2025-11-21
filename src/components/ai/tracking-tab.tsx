'use client';

import { useState, useEffect } from 'react';
import { Plus, Activity, ArrowRight, Trash2, AlertTriangle } from 'lucide-react';
import AddTopicDialog from './add-topic-dialog';
import TimelineView from './timeline-view';

export default function TrackingTab() {
    const [topics, setTopics] = useState<any[]>([]);
    const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    const fetchTopics = async () => {
        try {
            const res = await fetch('/api/ai/track');
            if (res.ok) {
                const data = await res.json();
                setTopics(data);
            }
        } catch (error) {
            console.error('Error fetching topics:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTopics();
    }, []);

    const handleAddTopic = async (keyword: string, domain?: string) => {
        try {
            const res = await fetch('/api/ai/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keyword, domain }),
            });

            if (res.ok) {
                const newTopic = await res.json();
                setTopics(prev => [newTopic, ...prev]);
                setSelectedTopicId(newTopic.id); // Auto-select new topic
            }
        } catch (error) {
            console.error('Error adding topic:', error);
        }
    };

    const handleDeleteTopic = async (id: string) => {
        try {
            const res = await fetch(`/api/ai/track?id=${id}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                setTopics(prev => prev.filter(t => t.id !== id));
                if (selectedTopicId === id) {
                    setSelectedTopicId(null);
                }
                setDeleteConfirmId(null);
            }
        } catch (error) {
            console.error('Error deleting topic:', error);
        }
    };

    const handleUpdateTopic = async (id: string) => {
        try {
            const res = await fetch('/api/ai/track/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });

            if (res.ok) {
                const updatedTopic = await res.json();
                setTopics(prev => prev.map(t => t.id === id ? updatedTopic : t));
            }
        } catch (error) {
            console.error('Error updating topic:', error);
        }
    };

    const selectedTopic = topics.find(t => t.id === selectedTopicId);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-[600px]">
            {/* Sidebar List */}
            <div className={`lg:col-span-4 ${selectedTopicId ? 'hidden lg:block' : 'block'}`}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-900">Subiecte Urmărite</h3>
                    <button
                        onClick={() => setIsAddDialogOpen(true)}
                        className="flex items-center gap-1 text-sm font-medium text-violet-600 hover:text-violet-700 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition"
                    >
                        <Plus className="h-4 w-4" />
                        Adaugă
                    </button>
                </div>

                <div className="space-y-3">
                    {isLoading ? (
                        <div className="text-center py-8 text-slate-500 text-sm">Se încarcă...</div>
                    ) : topics.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center">
                            <Activity className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                            <p className="text-sm font-medium text-slate-900 mb-1">Nu urmărești nimic</p>
                            <p className="text-xs text-slate-500 mb-3">Adaugă un subiect pentru a primi actualizări.</p>
                            <button
                                onClick={() => setIsAddDialogOpen(true)}
                                className="text-xs font-medium text-violet-600 hover:underline"
                            >
                                Adaugă primul subiect
                            </button>
                        </div>
                    ) : (
                        topics.map(topic => (
                            <div
                                key={topic.id}
                                className={`relative w-full rounded-xl border transition hover:shadow-md ${selectedTopicId === topic.id
                                    ? 'bg-violet-600 border-violet-600 text-white shadow-lg shadow-violet-200'
                                    : 'bg-white border-slate-200 text-slate-900 hover:border-violet-200'
                                    }`}
                            >
                                <button
                                    onClick={() => setSelectedTopicId(topic.id)}
                                    className="w-full text-left p-4 pr-12"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="font-bold capitalize">{topic.keyword}</span>
                                        {topic.history.length > 0 && (
                                            <span className={`text-xs px-1.5 py-0.5 rounded ${selectedTopicId === topic.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                {topic.history.length} update-uri
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between text-xs opacity-80">
                                        <span>{topic.domain || 'General'}</span>
                                        <span>{new Date(topic.lastUpdated).toLocaleDateString()}</span>
                                    </div>
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteConfirmId(topic.id);
                                    }}
                                    className={`absolute top-3 right-3 p-2 rounded-lg transition ${selectedTopicId === topic.id
                                        ? 'hover:bg-white/20 text-white'
                                        : 'hover:bg-red-50 text-slate-400 hover:text-red-600'
                                        }`}
                                    aria-label="Șterge subiect"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div className={`lg:col-span-8 ${!selectedTopicId ? 'hidden lg:block' : 'block'}`}>
                {selectedTopic ? (
                    <div className="h-full">
                        <TimelineView
                            topic={selectedTopic}
                            onDelete={handleDeleteTopic}
                            onUpdate={handleUpdateTopic}
                            onAnalyze={(article) => {
                                console.log('Analyze article:', article);
                                // Placeholder for future analysis logic
                            }}
                            onBack={() => setSelectedTopicId(null)}
                        />
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-12">
                        <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                            <Activity className="h-8 w-8 text-violet-500" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Selectează un subiect</h3>
                        <p className="text-slate-500 max-w-xs mx-auto">
                            Alege un subiect din listă pentru a vedea cronologia evenimentelor și analiza AI.
                        </p>
                    </div>
                )}
            </div>

            <AddTopicDialog
                isOpen={isAddDialogOpen}
                onClose={() => setIsAddDialogOpen(false)}
                onAdd={handleAddTopic}
            />

            {/* Delete Confirmation Modal */}
            {deleteConfirmId && (
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
                                onClick={() => setDeleteConfirmId(null)}
                                className="flex-1 rounded-xl border border-slate-200 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
                            >
                                Anulează
                            </button>
                            <button
                                onClick={() => handleDeleteTopic(deleteConfirmId)}
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
