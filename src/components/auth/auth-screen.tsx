'use client';

import { useState } from 'react';
import { Eye, EyeOff, Loader2, Mail, Lock, User, Phone, ArrowRight, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

type AuthMode = 'login' | 'register' | 'forgot';

export default function AuthScreen({ onLogin }: { onLogin: (user: any) => void }) {
    const [mode, setMode] = useState<AuthMode>('login');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const router = useRouter();

    // Form states
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');

    const switchMode = (newMode: AuthMode) => {
        setMode(newMode);
        setError('');
        setSuccess('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            if (mode === 'forgot') {
                // Simulate API call for password reset
                await new Promise(resolve => setTimeout(resolve, 1500));
                setSuccess('Dacă există un cont asociat acestui email, vei primi instrucțiuni de resetare a parolei.');
                setIsLoading(false);
                return;
            }

            const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';

            let body: any = { email, password };

            if (mode === 'register') {
                // Set default name if empty
                const finalName = name.trim() || 'Utilizator';
                body = {
                    email,
                    password,
                    name: finalName,
                    phone: phone.trim() || undefined
                };
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'A apărut o eroare');
            }

            // Save token to cookie (simplified for client-side)
            document.cookie = `auth_token=${data.token}; path=/; max-age=${60 * 60 * 24 * 30}`; // 30 days

            onLogin(data.user);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md mx-auto">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-slate-900">
                    {mode === 'login' && 'Bine ai revenit!'}
                    {mode === 'register' && 'Creează cont nou'}
                    {mode === 'forgot' && 'Resetare parolă'}
                </h2>
                <p className="text-slate-500 mt-2">
                    {mode === 'login' && 'Loghează-te pentru a accesa profilul tău.'}
                    {mode === 'register' && 'Alătură-te comunității stire.site.'}
                    {mode === 'forgot' && 'Introdu emailul pentru a primi instrucțiuni.'}
                </p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                {error && (
                    <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="mb-4 p-3 bg-green-50 text-green-600 text-sm rounded-lg border border-green-100 flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 shrink-0" />
                        <span>{success}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Email Field - Always visible */}
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                                placeholder="nume@exemplu.com"
                                required
                            />
                        </div>
                    </div>

                    {/* Password Field - Visible for Login and Register */}
                    {mode !== 'forgot' && (
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Parolă</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Optional Fields - Only for Register */}
                    {mode === 'register' && (
                        <div className="pt-2 border-t border-slate-100 mt-4">
                            <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">Opțional </p>
                            <p className="text-xs font-normal text-slate-400 mb-2">(în cazul în care doriți să vă autentificăm cu numărul de telefon)</p>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">Nume </label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                                            placeholder="Nume complet"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">Telefon</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <input
                                            type="tel"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                                            placeholder="07xx xxx xxx"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {mode === 'login' && (
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={() => switchMode('forgot')}
                                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                            >
                                Ai uitat parola?
                            </button>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20 mt-6"
                    >
                        {isLoading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <>
                                {mode === 'login' && 'Autentificare'}
                                {mode === 'register' && 'Creează cont'}
                                {mode === 'forgot' && 'Trimite link resetare'}
                                {!isLoading && <ArrowRight className="h-4 w-4" />}
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-6 pt-6 border-t border-slate-100 text-center">
                    {mode === 'login' ? (
                        <p className="text-sm text-slate-600">
                            Nu ai cont?{' '}
                            <button
                                onClick={() => switchMode('register')}
                                className="text-blue-600 font-semibold hover:text-blue-700"
                            >
                                Înregistrează-te
                            </button>
                        </p>
                    ) : (
                        <p className="text-sm text-slate-600">
                            {mode === 'forgot' ? 'Înapoi la autentificare?' : 'Ai deja cont?'}{' '}
                            <button
                                onClick={() => switchMode('login')}
                                className="text-blue-600 font-semibold hover:text-blue-700"
                            >
                                Loghează-te
                            </button>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
