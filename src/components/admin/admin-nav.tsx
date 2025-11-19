'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';

type AdminTab = 'articole' | 'categorii' | 'topicuri' | 'smgoogle' | 'gemini' | 'anunturi';

const adminTabs: { id: AdminTab; label: string }[] = [
  { id: 'articole', label: 'Articole' },
  { id: 'categorii', label: 'Categorii' },
  { id: 'topicuri', label: 'Topicuri' },
  { id: 'smgoogle', label: 'SMGoogle' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'anunturi', label: 'Anunturi' },
];

const AdminNav = () => {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('articole');

  const changeTab = (tabId: AdminTab) => {
    setActiveTab(tabId);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent<AdminTab>('admin-tab-change', { detail: tabId }));
    }
  };
  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          Navigatie admin
        </p>
        <nav className="hidden gap-2 text-xs font-medium text-slate-600 md:flex">
          {adminTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => changeTab(tab.id)}
              className={`rounded-full px-3 py-1 transition ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
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
            {adminTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className="rounded-2xl border border-slate-100 px-3 py-2 text-left text-sm hover:border-slate-200"
                onClick={() => {
                  changeTab(tab.id);
                  setOpen(false);
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminNav;
