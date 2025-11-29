import Link from 'next/link';
import MobileNav from '@/components/site/mobile-nav';
import SiteFooter from '@/components/site/site-footer';
import SiteHeader from '@/components/site/site-header';

export const metadata = {
    title: 'Pagina nu a fost găsită | stire.site',
    description: 'Pagina pe care o căutați nu există sau a fost mutată.',
};

export default function NotFound() {
    return (
        <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
            <SiteHeader />
            <main className="flex flex-grow flex-col items-center justify-center px-4 py-16 text-center sm:px-6 lg:px-8">
                <h1 className="text-6xl font-bold tracking-tight text-slate-900 sm:text-7xl">404</h1>
                <p className="mt-4 text-lg text-slate-600 sm:text-xl">
                    Ups! Pagina pe care o căutați nu a fost găsită.
                </p>
                <p className="mt-2 text-slate-500">
                    Este posibil să fi fost ștearsă, mutată sau link-ul să fie greșit.
                </p>
                <div className="mt-10">
                    <Link
                        href="/"
                        className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                    >
                        Înapoi la prima pagină
                    </Link>
                </div>
            </main>
            <SiteFooter />
            <MobileNav active="home" />
        </div>
    );
}
