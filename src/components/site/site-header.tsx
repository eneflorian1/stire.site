import Link from 'next/link';
import { ReactNode } from 'react';

type Props = {
  actions?: ReactNode;
};

const navItems = [
  { label: 'Home', href: '/' },
  { label: 'Categorii', href: '/categorii' },
  { label: 'Articole', href: '/articole' },
  { label: 'Admin', href: '/admin' },
  { label: 'Profil', href: '/profil' },
];

const SiteHeader = ({ actions }: Props) => (
  <header className="border-b border-slate-200 bg-white">
    <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 text-sm text-slate-600 md:flex-row md:items-center md:justify-between md:px-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold text-slate-900">
          Stire.site
        </Link>
        <div className="md:hidden">{actions}</div>
      </div>
      <nav className="hidden gap-6 md:flex">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} className="transition hover:text-slate-900">
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="hidden md:block">{actions}</div>
    </div>
  </header>
);
 
export default SiteHeader;
