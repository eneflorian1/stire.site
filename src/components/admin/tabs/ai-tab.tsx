'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Save, RefreshCw, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { getCacheStats, clearCache, clearExpiredCache } from '@/lib/ai-cache';

const AITab = () => {
    const [config, setConfig] = useState({
        provider: 'openai',
        apiKey: '',
        model: 'gpt-3.5-turbo',
        maxTokens: '1000',
        temperature: '0.7',
    });

    const [cacheStats, setCacheStats] = useState({
        totalEntries: 0,
        withCredibility: 0,
        withSummary: 0,
        expiredEntries: 0,
    });

    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [testMessage, setTestMessage] = useState('');

    useEffect(() => {
        // Load cache stats
        const stats = getCacheStats();
        setCacheStats(stats);

        // Load config from localStorage (client-side only)
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('ai-admin-config');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    setConfig(parsed);
                } catch {
                    // Ignore parse errors
                }
            }
        }
    }, []);

    const handleSave = () => {
        setSaveStatus('saving');

        try {
            // Save to localStorage (this is just for UI, actual config is in .env)
            localStorage.setItem('ai-admin-config', JSON.stringify(config));

            setSaveStatus('success');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch {
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 2000);
        }
    };

    const handleTest = async () => {
        setTestStatus('testing');
        setTestMessage('');

        try {
            // Test API connection by trying to analyze a dummy article
            const response = await fetch('/api/ai/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ articleId: 'test' }),
            });

            if (response.ok) {
                setTestStatus('success');
                setTestMessage('API connection successful!');
            } else {
                const error = await response.json();
                setTestStatus('error');
                setTestMessage(error.error || 'API test failed');
            }
        } catch (error) {
            setTestStatus('error');
            setTestMessage(error instanceof Error ? error.message : 'Connection failed');
        }

        setTimeout(() => {
            setTestStatus('idle');
            setTestMessage('');
        }, 5000);
    };

    const handleClearCache = () => {
        if (confirm('Ștergi toate rezultatele AI din cache?')) {
            clearCache();
            const stats = getCacheStats();
            setCacheStats(stats);
        }
    };

    const handleClearExpired = () => {
        clearExpiredCache();
        const stats = getCacheStats();
        setCacheStats(stats);
    };

    const refreshStats = () => {
        const stats = getCacheStats();
        setCacheStats(stats);
    };

    return (
        <div className="space-y-6">
            {/* Header */}


            {/* Configuration Section */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-semibold text-slate-900">API Configuration</h3>

                <div className="mb-4 rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
                    <strong>Note:</strong> For security, API keys should be set in <code className="rounded bg-blue-100 px-1.5 py-0.5">.env.local</code> file.
                    This form is for reference only.
                </div>

                <div className="space-y-4">
                    {/* Provider */}
                    <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                            AI Provider
                        </label>
                        <select
                            value={config.provider}
                            onChange={(e) => setConfig({ ...config, provider: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 px-4 py-2 text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                        >
                            <option value="openai">OpenAI (GPT-3.5/4)</option>
                            <option value="anthropic">Anthropic (Claude)</option>
                            <option value="gemini">Google Gemini</option>
                        </select>
                    </div>

                    {/* API Key */}
                    <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                            API Key
                        </label>
                        <input
                            type="password"
                            value={config.apiKey}
                            onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                            placeholder="Set in .env.local as AI_API_KEY"
                            className="w-full rounded-lg border border-slate-200 px-4 py-2 text-slate-900 placeholder-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                        />
                    </div>

                    {/* Model */}
                    <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                            Model
                        </label>
                        <input
                            type="text"
                            value={config.model}
                            onChange={(e) => setConfig({ ...config, model: e.target.value })}
                            placeholder="e.g., gpt-3.5-turbo"
                            className="w-full rounded-lg border border-slate-200 px-4 py-2 text-slate-900 placeholder-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                        />
                    </div>

                    {/* Max Tokens */}
                    <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                            Max Tokens
                        </label>
                        <input
                            type="number"
                            value={config.maxTokens}
                            onChange={(e) => setConfig({ ...config, maxTokens: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 px-4 py-2 text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                        />
                    </div>

                    {/* Temperature */}
                    <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                            Temperature (0.0 - 1.0)
                        </label>
                        <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="1"
                            value={config.temperature}
                            onChange={(e) => setConfig({ ...config, temperature: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 px-4 py-2 text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saveStatus === 'saving'}
                            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-700 disabled:opacity-50"
                        >
                            {saveStatus === 'saving' ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : saveStatus === 'success' ? (
                                <CheckCircle className="h-4 w-4" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'success' ? 'Saved!' : 'Save Config'}
                        </button>

                        <button
                            type="button"
                            onClick={handleTest}
                            disabled={testStatus === 'testing'}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                        >
                            {testStatus === 'testing' ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : testStatus === 'success' ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : testStatus === 'error' ? (
                                <XCircle className="h-4 w-4 text-red-600" />
                            ) : (
                                <Sparkles className="h-4 w-4" />
                            )}
                            Test API
                        </button>
                    </div>

                    {testMessage && (
                        <div className={`rounded-lg p-3 text-sm ${testStatus === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                            }`}>
                            {testMessage}
                        </div>
                    )}
                </div>
            </div>

            {/* Cache Management */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">Cache Management</h3>
                    <button
                        type="button"
                        onClick={refreshStats}
                        className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100"
                        aria-label="Refresh stats"
                    >
                        <RefreshCw className="h-4 w-4" />
                    </button>
                </div>

                <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg bg-slate-50 p-4">
                        <div className="text-2xl font-bold text-slate-900">{cacheStats.totalEntries}</div>
                        <div className="text-sm text-slate-600">Total Entries</div>
                    </div>
                    <div className="rounded-lg bg-green-50 p-4">
                        <div className="text-2xl font-bold text-green-900">{cacheStats.withCredibility}</div>
                        <div className="text-sm text-green-700">With Credibility</div>
                    </div>
                    <div className="rounded-lg bg-blue-50 p-4">
                        <div className="text-2xl font-bold text-blue-900">{cacheStats.withSummary}</div>
                        <div className="text-sm text-blue-700">With Summary</div>
                    </div>
                    <div className="rounded-lg bg-red-50 p-4">
                        <div className="text-2xl font-bold text-red-900">{cacheStats.expiredEntries}</div>
                        <div className="text-sm text-red-700">Expired</div>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={handleClearExpired}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                        <Trash2 className="h-4 w-4" />
                        Clear Expired
                    </button>
                    <button
                        type="button"
                        onClick={handleClearCache}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
                    >
                        <Trash2 className="h-4 w-4" />
                        Clear All Cache
                    </button>
                </div>
            </div>

            {/* Documentation */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-semibold text-slate-900">Environment Variables</h3>
                <div className="space-y-2 rounded-lg bg-slate-900 p-4 font-mono text-sm text-slate-100">
                    <div><span className="text-green-400">AI_PROVIDER</span>=openai</div>
                    <div><span className="text-green-400">AI_API_KEY</span>=your_api_key_here</div>
                    <div><span className="text-green-400">AI_MODEL</span>=gpt-3.5-turbo</div>
                    <div><span className="text-green-400">AI_MAX_TOKENS</span>=1000</div>
                    <div><span className="text-green-400">AI_TEMPERATURE</span>=0.7</div>
                </div>
                <p className="mt-3 text-sm text-slate-600">
                    Add these variables to your <code className="rounded bg-slate-100 px-1.5 py-0.5">.env.local</code> file to enable AI features.
                </p>
            </div>
        </div>
    );
};

export default AITab;
