'use client';

import Link from 'next/link';
import { Menu } from 'lucide-react';
import { ReactNode, useState } from 'react';
import SearchBar from './search-bar';

type Props = {
  actions?: ReactNode;
  showSearch?: boolean;
};

const navItems = [
  { label: 'Home', href: '/' },
  { label: 'Categorii', href: '/categorii' },
  { label: 'AI', href: '/ai' },
  { label: 'Salvate', href: '/salvate' },
  { label: 'Articole', href: '/articole' },
  { label: 'Admin', href: '/admin' },
  { label: 'Profil', href: '/profil' },
];

const SiteHeader = ({ actions, showSearch = false }: Props) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent<string>('home-search-change', { detail: value }));
    }
  };

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 text-sm text-slate-600 md:gap-6 md:px-6">
        <Link href="/" className="text-lg font-semibold text-slate-900">
          Stire
        </Link>

        {showSearch && (
          <div className="flex-1">
            <SearchBar
              value={searchValue}
              onChange={handleSearchChange}
              placeholder="Cauta stiri, categorii, topicuri..."
              variant="minimal"
            />
          </div>
        )}

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 p-2 text-slate-600 transition hover:border-slate-300 hover:text-slate-900 md:hidden"
          aria-label="Deschide meniul"
          onClick={() => setMobileOpen((prev) => !prev)}
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="hidden items-center gap-6 md:flex md:flex-none">
          <nav className="flex gap-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="transition hover:text-slate-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          {actions && <div>{actions}</div>}
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 md:hidden">
          <nav className="flex flex-col gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl px-3 py-2 hover:bg-slate-50"
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            {actions && <div className="mt-2 border-t border-slate-100 pt-2">{actions}</div>}
          </nav>
        </div>
      )}
    </header>
  );
};

export default SiteHeader;
