"use client";
'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';

const adminAnchors = [
  { href: '#admin-dashboard', label: 'Dashboard' },
  { href: '#admin-create-article', label: 'Creeaza articol' },
];

const AdminNav = () => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-6">
        <p className="text-sm font-semibold text-slate-700">Navigatie admin</p>
        <nav className="hidden gap-4 text-sm text-slate-600 md:flex">
          {adminAnchors.map((anchor) => (
            <a key={anchor.href} href={anchor.href} className="hover:text-slate-900">
              {anchor.label}
            </a>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="rounded-2xl border border-slate-200 p-2 text-slate-600 transition hover:border-slate-300 hover:text-slate-900 md:hidden"
          aria-label="Menu admin"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>
      {open && (
        <div className="border-t border-slate-100 bg-white px-4 py-3 text-sm text-slate-600 md:hidden">
          <div className="flex flex-col gap-2">
            {adminAnchors.map((anchor) => (
              <a
                key={anchor.href}
                href={anchor.href}
                className="rounded-2xl border border-slate-100 px-4 py-2 hover:border-slate-200"
                onClick={() => setOpen(false)}
              >
                {anchor.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminNav;
