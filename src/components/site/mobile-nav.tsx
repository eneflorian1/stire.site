'use client';

import Link from 'next/link';
import { Bookmark, Grid, Home, Sparkles, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type NavKey = 'home' | 'categorii' | 'ai' | 'salvate' | 'profil';

const navItems: { id: NavKey; label: string; href: string; icon: LucideIcon }[] = [
  { id: 'home', label: 'Acasa', href: '/', icon: Home },
  { id: 'categorii', label: 'Categorii', href: '/categorii', icon: Grid },
  { id: 'ai', label: 'AI', href: '/ai', icon: Sparkles },
  { id: 'salvate', label: 'Salvate', href: '/salvate', icon: Bookmark },
  { id: 'profil', label: 'Profil', href: '/profil', icon: User },
];

type Props = {
  active: NavKey;
};

const MobileNav = ({ active }: Props) => (
  <nav className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
    <div className="mx-auto flex max-w-md items-center justify-between px-6 py-3 text-xs text-slate-500">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.id === active;
        return (
          <Link
            key={item.id}
            href={item.href}
            className={`flex flex-col items-center gap-1 transition ${isActive ? 'text-slate-900' : 'hover:text-slate-700'
              }`}
          >
            <Icon className="h-5 w-5" />
            {item.label}
          </Link>
        );
      })}
    </div>
  </nav>
);

export default MobileNav;
