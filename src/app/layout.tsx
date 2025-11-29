import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://stire.site'),
  title: {
    default: 'stire.site',
    template: '%s | stire.site',
  },
  description:
    'stire.site agregă și generează știri în limba română, pe categorii și subiecte actuale, cu sitemap-uri și indexare optimizate pentru Google.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ro">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen flex flex-col antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
