import { Metadata } from 'next';
import AdminDashboard from '@/components/admin-dashboard';
import AdminNav from '@/components/admin/admin-nav';
import SiteFooter from '@/components/site/site-footer';
import SiteHeader from '@/components/site/site-header';

export const metadata: Metadata = {
  title: 'Admin Dashboard',
  robots: {
    index: false,
    follow: false,
  },
};

const AdminPage = () => (
  <div className="min-h-screen bg-slate-50 pb-10">
    <SiteHeader />
    <AdminNav />
    <section className="bg-slate-50 px-4 py-10 text-slate-900 md:px-6">
      <div className="mx-auto max-w-6xl rounded-3xl border border-slate-200 bg-white p-4 md:p-6">
        <AdminDashboard />
      </div>
    </section>
    <SiteFooter />
  </div>
);

export default AdminPage;
