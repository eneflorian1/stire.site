import Link from 'next/link';

const SiteFooter = () => (
  <footer className="hidden md:block border-t border-slate-200 bg-white">
    <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-slate-600 md:px-6">
      <span>© {new Date().getFullYear()} stire.site</span>

    </div>
  </footer>
);

export default SiteFooter;
