import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { AuthProvider } from '@/components/AuthProvider';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Facts on Daily News – AI Fakta-Check Dashboard',
  description: 'AI-drevet nyhedsdashboard med fakta-check via Grok (xAI). Danske og internationale nyheder med troværdighedsscore.',
  keywords: ['nyheder', 'fakta-check', 'AI', 'Grok', 'Danmark', 'dashboard'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="da" className="dark">
      <body className={`${inter.variable} min-h-screen bg-zinc-950 text-[#c5c5c5] antialiased`}>
        <AuthProvider>
          <div className="flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
