import type { Metadata } from 'next';
import SiteFooter from '@/components/site/site-footer';
import SiteHeader from '@/components/site/site-header';

export const metadata: Metadata = {
    title: 'Termeni și Condiții – stire.site',
    description: 'Termeni și condiții de utilizare pentru stire.site',
};

const TermeniPage = () => (
    <div className="min-h-screen bg-slate-50 text-slate-900">
        <SiteHeader />
        <main className="mx-auto max-w-4xl px-4 py-12 md:px-6">
            <article className="rounded-3xl border border-slate-200 bg-white p-8 md:p-12">
                <h1 className="mb-8 text-4xl font-bold text-slate-900">Termeni și Condiții</h1>

                <div className="prose prose-slate max-w-none space-y-6 text-slate-700">
                    <section>
                        <h2 className="mb-4 text-2xl font-semibold text-slate-900">1. Acceptarea Termenilor</h2>
                        <p>
                            Prin accesarea și utilizarea site-ului stire.site, acceptați să respectați și să fiți obligat de
                            acești termeni și condiții de utilizare. Dacă nu sunteți de acord cu oricare dintre acești termeni,
                            vă rugăm să nu utilizați acest site.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-4 text-2xl font-semibold text-slate-900">2. Utilizarea Conținutului</h2>
                        <p>
                            Conținutul disponibil pe stire.site este furnizat în scop informativ. Articolele sunt generate
                            automat și curate din diverse surse. Ne rezervăm dreptul de a modifica sau elimina orice conținut
                            fără notificare prealabilă.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-4 text-2xl font-semibold text-slate-900">3. Proprietate Intelectuală</h2>
                        <p>
                            Tot conținutul prezent pe acest site, inclusiv dar fără a se limita la text, grafică, logo-uri,
                            imagini și software, este proprietatea stire.site sau a furnizorilor săi de conținut și este
                            protejat de legile privind drepturile de autor.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-4 text-2xl font-semibold text-slate-900">4. Limitarea Răspunderii</h2>
                        <p>
                            stire.site nu își asumă responsabilitatea pentru acuratețea, completitudinea sau utilitatea
                            informațiilor furnizate. Utilizarea informațiilor de pe acest site se face pe propriul risc.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-4 text-2xl font-semibold text-slate-900">5. Modificări ale Termenilor</h2>
                        <p>
                            Ne rezervăm dreptul de a modifica acești termeni și condiții în orice moment. Modificările vor
                            intra în vigoare imediat după publicarea pe site. Utilizarea continuă a site-ului după astfel de
                            modificări constituie acceptarea noilor termeni.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-4 text-2xl font-semibold text-slate-900">6. Contact</h2>
                        <p>
                            Pentru întrebări referitoare la acești termeni și condiții, vă rugăm să ne contactați prin
                            intermediul paginii de <a href="/contact" className="text-blue-600 hover:underline">Contact</a>.
                        </p>
                    </section>

                    <p className="mt-8 text-sm text-slate-500">
                        Ultima actualizare: {new Date().toLocaleDateString('ro-RO', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>
            </article>
        </main>
        <SiteFooter />
    </div>
);

export default TermeniPage;
