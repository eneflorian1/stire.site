'use client';

import { User, LogOut, Settings, Bookmark, Sparkles, Bell, Mail, Phone as PhoneIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface UserData {
    id: string;
    name: string;
    email: string;
    phone?: string;
    savedArticles: string[];
    aiInteractions: any[];
    preferences: {
        notifications: boolean;
        newsletter: boolean;
    };
}

export default function UserDashboard({ user, onLogout }: { user: UserData; onLogout: () => void }) {
    const router = useRouter();

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            // Clear cookie
            document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
            onLogout();
            router.refresh();
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header Profile Card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row items-center md:items-start gap-6">
                <div className="h-24 w-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-blue-500/20">
                    {user.name.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 text-center md:text-left space-y-2">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">{user.name}</h2>
                        <p className="text-slate-500 text-sm">Membru din {new Date().getFullYear()}</p>
                    </div>

                    <div className="flex flex-wrap justify-center md:justify-start gap-3 text-sm text-slate-600">
                        <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                            <Mail className="h-3.5 w-3.5 text-slate-400" />
                            {user.email}
                        </div>
                        {user.phone && (
                            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                                <PhoneIcon className="h-3.5 w-3.5 text-slate-400" />
                                {user.phone}
                            </div>
                        )}
                    </div>
                </div>

                <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
                >
                    <LogOut className="h-4 w-4" />
                    Deconectare
                </button>
            </div>

            {/* Quick Stats / Actions */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Link href="/salvate" className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                    <div className="h-10 w-10 bg-amber-50 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Bookmark className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900">{user.savedArticles.length}</div>
                    <div className="text-xs text-slate-500 font-medium">Articole Salvate</div>
                </Link>

                <Link href="/ai" className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                    <div className="h-10 w-10 bg-purple-50 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Sparkles className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900">{user.aiInteractions.length}</div>
                    <div className="text-xs text-slate-500 font-medium">Interacțiuni AI</div>
                </Link>

                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <div className="h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center mb-3">
                        <Bell className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900">{user.preferences.notifications ? 'ON' : 'OFF'}</div>
                    <div className="text-xs text-slate-500 font-medium">Notificări</div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <div className="h-10 w-10 bg-slate-50 rounded-lg flex items-center justify-center mb-3">
                        <Settings className="h-5 w-5 text-slate-600" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900">Setări</div>
                    <div className="text-xs text-slate-500 font-medium">Cont</div>
                </div>
            </div>

            {/* Recent Activity / Content */}
            <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                    <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-purple-500" />
                        Activitate Recentă AI
                    </h3>
                    {user.aiInteractions.length > 0 ? (
                        <div className="space-y-3">
                            {user.aiInteractions.slice(-3).reverse().map((interaction, i) => (
                                <div key={i} className="p-3 bg-slate-50 rounded-lg text-sm">
                                    <p className="font-medium text-slate-900 line-clamp-1">{interaction.query}</p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {new Date(interaction.timestamp).toLocaleDateString('ro-RO')}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-slate-400 text-sm">
                            Nu ai interacțiuni recente cu AI-ul.
                            <Link href="/ai" className="block mt-2 text-blue-600 hover:underline">Încearcă acum</Link>
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                    <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                        <Settings className="h-4 w-4 text-slate-500" />
                        Preferințe
                    </h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                            <div>
                                <p className="font-medium text-slate-900 text-sm">Notificări Push</p>
                                <p className="text-xs text-slate-500">Primește alerte pentru știri importante</p>
                            </div>
                            <div className={`w-10 h-6 rounded-full relative transition-colors ${user.preferences.notifications ? 'bg-blue-600' : 'bg-slate-300'}`}>
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${user.preferences.notifications ? 'left-5' : 'left-1'}`} />
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                            <div>
                                <p className="font-medium text-slate-900 text-sm">Newsletter Săptămânal</p>
                                <p className="text-xs text-slate-500">Rezumatul celor mai importante știri</p>
                            </div>
                            <div className={`w-10 h-6 rounded-full relative transition-colors ${user.preferences.newsletter ? 'bg-blue-600' : 'bg-slate-300'}`}>
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${user.preferences.newsletter ? 'left-5' : 'left-1'}`} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
