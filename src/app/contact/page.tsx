import type { Metadata } from 'next';
import SiteFooter from '@/components/site/site-footer';
import SiteHeader from '@/components/site/site-header';
import { Mail, MessageSquare, Globe } from 'lucide-react';

export const metadata: Metadata = {
    title: 'Contact – stire.site',
    description: 'Contactează echipa stire.site pentru întrebări, sugestii sau suport',
};

const ContactPage = () => (
    <div className="min-h-screen bg-slate-50 text-slate-900">
        <SiteHeader />
        <main className="mx-auto max-w-4xl px-4 py-12 md:px-6">
            <article className="rounded-3xl border border-slate-200 bg-white p-8 md:p-12">
                <h1 className="mb-8 text-4xl font-bold text-slate-900">Contact</h1>

                <div className="space-y-8">
                    <p className="text-lg text-slate-700">
                        Suntem aici pentru a vă ajuta! Dacă aveți întrebări, sugestii sau aveți nevoie de suport,
                        nu ezitați să ne contactați.
                    </p>

                    <div className="grid gap-6 md:grid-cols-3">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
                            <div className="mb-4 flex justify-center">
                                <div className="rounded-full bg-blue-100 p-3">
                                    <Mail className="h-6 w-6 text-blue-600" />
                                </div>
                            </div>
                            <h3 className="mb-2 font-semibold text-slate-900">Email</h3>
                            <p className="text-sm text-slate-600">
                                <a href="mailto:contact@stire.site" className="text-blue-600 hover:underline">
                                    contact@stire.site
                                </a>
                            </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
                            <div className="mb-4 flex justify-center">
                                <div className="rounded-full bg-green-100 p-3">
                                    <MessageSquare className="h-6 w-6 text-green-600" />
                                </div>
                            </div>
                            <h3 className="mb-2 font-semibold text-slate-900">Suport</h3>
                            <p className="text-sm text-slate-600">
                                Răspundem în maxim 24 de ore
                            </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
                            <div className="mb-4 flex justify-center">
                                <div className="rounded-full bg-purple-100 p-3">
                                    <Globe className="h-6 w-6 text-purple-600" />
                                </div>
                            </div>
                            <h3 className="mb-2 font-semibold text-slate-900">Website</h3>
                            <p className="text-sm text-slate-600">
                                <a href="https://stire.site" className="text-blue-600 hover:underline">
                                    stire.site
                                </a>
                            </p>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-50 to-purple-50 p-8">
                        <h2 className="mb-4 text-2xl font-semibold text-slate-900">Trimite-ne un mesaj</h2>
                        <p className="mb-6 text-slate-700">
                            Completează formularul de mai jos și te vom contacta în cel mai scurt timp posibil.
                        </p>

                        <form className="space-y-4">
                            <div>
                                <label htmlFor="name" className="mb-2 block text-sm font-medium text-slate-700">
                                    Nume
                                </label>
                                <input
                                    type="text"
                                    id="name"
                                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    placeholder="Numele tău"
                                />
                            </div>

                            <div>
                                <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    placeholder="email@exemplu.ro"
                                />
                            </div>

                            <div>
                                <label htmlFor="subject" className="mb-2 block text-sm font-medium text-slate-700">
                                    Subiect
                                </label>
                                <input
                                    type="text"
                                    id="subject"
                                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    placeholder="Despre ce vrei să discutăm?"
                                />
                            </div>

                            <div>
                                <label htmlFor="message" className="mb-2 block text-sm font-medium text-slate-700">
                                    Mesaj
                                </label>
                                <textarea
                                    id="message"
                                    rows={6}
                                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    placeholder="Scrie-ne mesajul tău aici..."
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full rounded-xl bg-blue-600 px-6 py-3 font-medium text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            >
                                Trimite Mesajul
                            </button>
                        </form>

                        <p className="mt-4 text-sm text-slate-600">
                            * Formularul este momentan în dezvoltare. Te rugăm să ne contactezi direct la adresa de email.
                        </p>
                    </div>
                </div>
            </article>
        </main>
        <SiteFooter />
    </div>
);

export default ContactPage;
