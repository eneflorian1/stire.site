import Link from 'next/link';

const SiteFooter = () => (
  <footer className="hidden md:block border-t border-slate-200 bg-white">
    <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-slate-600 md:px-6">
      <span>© {new Date().getFullYear()} stire.site</span>
      <div className="flex gap-4">
        <Link href="/" className="hover:text-slate-900">
          Home
        </Link>
        <Link href="/articole" className="hover:text-slate-900">
          Articole
        </Link>
        <Link href="/admin" className="hover:text-slate-900">
          Admin
        </Link>
      </div>
    </div>
  </footer>
);

export default SiteFooter;
