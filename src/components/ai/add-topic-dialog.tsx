'use client';

import { useState } from 'react';
import { X, Loader2, Globe, Search } from 'lucide-react';

interface AddTopicDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (keyword: string, domain?: string) => Promise<void>;
}

export default function AddTopicDialog({ isOpen, onClose, onAdd }: AddTopicDialogProps) {
    const [keyword, setKeyword] = useState('');
    const [domain, setDomain] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!keyword.trim()) return;

        setIsLoading(true);
        try {
            await onAdd(keyword, domain);
            setKeyword('');
            setDomain('');
            onClose();
        } catch (error) {
            console.error('Failed to add topic:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                <div className="mb-6 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-slate-900">Urmărește un subiect nou</h3>
                    <button
                        onClick={onClose}
                        className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">
                            Cuvânt cheie sau Subiect
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                                placeholder="Ex: Bitcoin, Alegeri SUA, Inteligență Artificială..."
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-900 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">
                            Domeniu specific (Opțional)
                        </label>
                        <div className="relative">
                            <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <select
                                value={domain}
                                onChange={(e) => setDomain(e.target.value)}
                                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-900 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                            >
                                <option value="">Toate domeniile</option>
                                <option value="crypto">Crypto & Blockchain</option>
                                <option value="finance">Finanțe & Economie</option>
                                <option value="tech">Tehnologie</option>
                                <option value="cybersecurity">Securitate Cibernetică</option>
                                <option value="politics">Politică</option>
                            </select>
                        </div>
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={isLoading || !keyword.trim()}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 font-medium text-white transition hover:bg-violet-700 disabled:opacity-50"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Se inițializează urmărirea...
                                </>
                            ) : (
                                'Începe Urmărirea'
                            )}
                        </button>
                        <p className="mt-3 text-center text-xs text-slate-500">
                            AI-ul va căuta știri externe și va construi un istoric pentru acest subiect.
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
}
