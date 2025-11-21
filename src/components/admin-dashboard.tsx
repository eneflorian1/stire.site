'use client';

import { useEffect, useState } from 'react';
import ArticlesTab from '@/components/admin/tabs/articles-tab';
import AITab from '@/components/admin/tabs/ai-tab';
import BannerTab from '@/components/admin/tabs/banner-tab';
import CategoriesTab from '@/components/admin/tabs/categories-tab';
import GeminiTab from '@/components/admin/tabs/gemini-tab';
import SMGoogleTab from '@/components/admin/tabs/smgoogle-tab';
import TopicsTab from '@/components/admin/tabs/topics-tab';

type Tab = 'articole' | 'categorii' | 'topicuri' | 'smgoogle' | 'gemini' | 'ai' | 'anunturi';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState<Tab>('articole');

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<Tab>;
      if (custom.detail) {
        setActiveTab(custom.detail);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('admin-tab-change', handler as EventListener);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('admin-tab-change', handler as EventListener);
      }
    };
  }, []);

  const renderTab = () => {
    switch (activeTab) {
      case 'articole':
        return <ArticlesTab />;
      case 'categorii':
        return <CategoriesTab />;
      case 'topicuri':
        return <TopicsTab />;
      case 'smgoogle':
        return <SMGoogleTab />;
      case 'gemini':
        return <GeminiTab />;
      case 'ai':
        return <AITab />;
      case 'anunturi':
        return <BannerTab />;
      default:
        return null;
    }
  };

  const currentTitle: string = (() => {
    switch (activeTab) {
      case 'articole':
        return 'Articole';
      case 'categorii':
        return 'Categorii';
      case 'topicuri':
        return 'Topicuri';
      case 'smgoogle':
        return 'SMGoogle';
      case 'gemini':
        return 'Gemini';
      case 'ai':
        return 'AI Analysis';
      case 'anunturi':
        return 'Anunturi';
      default:
        return 'Admin';
    }
  })();

  return (
    <section id="admin-dashboard" className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">{currentTitle}</h1>
      </header>

      {renderTab()}
    </section>
  );
};

export default AdminDashboard;
