'use client';

import { useEffect, useState } from 'react';
import MobileNav from '@/components/site/mobile-nav';
import SiteFooter from '@/components/site/site-footer';
import SiteHeader from '@/components/site/site-header';
import AuthScreen from '@/components/auth/auth-screen';
import UserDashboard from '@/components/profile/user-dashboard';
import { Loader2 } from 'lucide-react';
import SearchBar from '@/components/site/search-bar';

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-10 md:px-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="mt-4 text-sm text-slate-500">Se încarcă profilul...</p>
          </div>
        ) : user ? (
          <UserDashboard user={user} onLogout={() => setUser(null)} />
        ) : (
          <AuthScreen onLogin={setUser} />
        )}
      </main>
      <SiteFooter />
      <MobileNav active="profil" />
    </div>
  );
}
