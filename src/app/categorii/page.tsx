import Link from 'next/link';
import MobileNav from '@/components/site/mobile-nav';
import SiteFooter from '@/components/site/site-footer';
import SiteHeader from '@/components/site/site-header';
import { getCategories } from '@/lib/categories';

export default async function CategoriiPage() {
  const categories = await getCategories();
  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10 md:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">Categorii</h1>
          <p className="text-sm text-slate-500">
            Arunca o privire peste temele pe care redactia le acopera in fiecare zi.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/articole?categorie=${category.slug}`}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1"
            >
              <h2 className="text-lg font-semibold text-slate-900">{category.name}</h2>
              <p className="mt-3 text-xs uppercase tracking-wide text-slate-400">
                slug: {category.slug}
              </p>
            </Link>
          ))}
          {categories.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              Nu exista inca nicio categorie. Adauga una din panoul de administrare.
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
      <MobileNav active="categorii" />
    </div>
  );
}
