import MobileNav from '@/components/site/mobile-nav';
import SiteFooter from '@/components/site/site-footer';
import SiteHeader from '@/components/site/site-header';

const ProfilePage = () => (
  <div className="min-h-screen bg-slate-50 pb-24">
    <SiteHeader />
    <main className="mx-auto max-w-4xl px-4 py-10 md:px-6">
      <h1 className="text-2xl font-semibold text-slate-900">Profilul meu</h1>
      <p className="mt-2 text-sm text-slate-500">
        Zona de profil va include preferinte, notificari si acces rapid la zonele de lucru.
      </p>
      <div className="mt-6 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
        In curand vei putea personaliza experienta stire.site din aceasta sectiune.
      </div>
    </main>
    <SiteFooter />
    <MobileNav active="profil" />
  </div>
);

export default ProfilePage;
