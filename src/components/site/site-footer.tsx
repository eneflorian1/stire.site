import Link from 'next/link';

const SiteFooter = () => (
  <footer className="hidden md:block mt-auto border-t border-slate-200 bg-white">
    <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-slate-600 md:px-6">
      <span>© {new Date().getFullYear()} stire.site</span>
      <div className="flex gap-6">
        <Link href="/termeni" className="transition hover:text-slate-900">
          Termeni și Condiții
        </Link>
        <Link href="/confidentialitate" className="transition hover:text-slate-900">
          Confidențialitate
        </Link>
        <Link href="/contact" className="transition hover:text-slate-900">
          Contact
        </Link>
      </div>
    </div>
  </footer>
);

export default SiteFooter;
