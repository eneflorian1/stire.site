import type { Metadata } from 'next';
import SiteFooter from '@/components/site/site-footer';
import SiteHeader from '@/components/site/site-header';

export const metadata: Metadata = {
    title: 'Politica de Confidențialitate – stire.site',
    description: 'Politica de confidențialitate și protecția datelor pentru stire.site',
};

const ConfidentialitePage = () => (
    <div className="min-h-screen bg-slate-50 text-slate-900">
        <SiteHeader />
        <main className="mx-auto max-w-4xl px-4 py-12 md:px-6">
            <article className="rounded-3xl border border-slate-200 bg-white p-8 md:p-12">
                <h1 className="mb-8 text-4xl font-bold text-slate-900">Politica de Confidențialitate</h1>

                <div className="prose prose-slate max-w-none space-y-6 text-slate-700">
                    <section>
                        <h2 className="mb-4 text-2xl font-semibold text-slate-900">1. Introducere</h2>
                        <p>
                            La stire.site, confidențialitatea dumneavoastră este importantă pentru noi. Această politică de
                            confidențialitate explică ce informații colectăm, cum le utilizăm și cum le protejăm.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-4 text-2xl font-semibold text-slate-900">2. Informații Colectate</h2>
                        <p>
                            Colectăm următoarele tipuri de informații:
                        </p>
                        <ul className="ml-6 list-disc space-y-2">
                            <li>Informații de navigare (adresă IP, tip browser, pagini vizitate)</li>
                            <li>Cookie-uri pentru îmbunătățirea experienței utilizatorului</li>
                            <li>Preferințe de utilizare (articole salvate, setări personalizate)</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="mb-4 text-2xl font-semibold text-slate-900">3. Utilizarea Informațiilor</h2>
                        <p>
                            Utilizăm informațiile colectate pentru:
                        </p>
                        <ul className="ml-6 list-disc space-y-2">
                            <li>Îmbunătățirea funcționalității site-ului</li>
                            <li>Personalizarea experienței utilizatorului</li>
                            <li>Analiză statistică și optimizare</li>
                            <li>Respectarea obligațiilor legale</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="mb-4 text-2xl font-semibold text-slate-900">4. Cookie-uri</h2>
                        <p>
                            Utilizăm cookie-uri pentru a stoca preferințele dumneavoastră și pentru a îmbunătăți experiența
                            de navigare. Puteți configura browser-ul pentru a refuza cookie-urile, dar acest lucru poate
                            afecta funcționalitatea site-ului.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-4 text-2xl font-semibold text-slate-900">5. Protecția Datelor</h2>
                        <p>
                            Implementăm măsuri de securitate adecvate pentru a proteja informațiile dumneavoastră împotriva
                            accesului neautorizat, modificării, divulgării sau distrugerii.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-4 text-2xl font-semibold text-slate-900">6. Partajarea Informațiilor</h2>
                        <p>
                            Nu vindem, nu schimbăm și nu transferăm informațiile dumneavoastră personale către terți fără
                            consimțământul dumneavoastră, cu excepția cazurilor în care legea o impune.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-4 text-2xl font-semibold text-slate-900">7. Drepturile Dumneavoastră</h2>
                        <p>
                            Aveți dreptul de a accesa, corecta sau șterge informațiile personale pe care le deținem despre
                            dumneavoastră. Pentru exercitarea acestor drepturi, vă rugăm să ne contactați.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-4 text-2xl font-semibold text-slate-900">8. Modificări ale Politicii</h2>
                        <p>
                            Ne rezervăm dreptul de a actualiza această politică de confidențialitate. Vă vom notifica despre
                            orice modificări semnificative prin publicarea noii politici pe această pagină.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-4 text-2xl font-semibold text-slate-900">9. Contact</h2>
                        <p>
                            Pentru întrebări referitoare la această politică de confidențialitate, vă rugăm să ne contactați
                            prin intermediul paginii de <a href="/contact" className="text-blue-600 hover:underline">Contact</a>.
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

export default ConfidentialitePage;
