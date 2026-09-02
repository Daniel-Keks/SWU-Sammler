import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'SWU Sammler – Collection Tracker',
  description: 'Star Wars: Unlimited Sammlung schnell und übersichtlich verwalten.',
  openGraph: {
    title: 'SWU Sammler – Collection Tracker',
    description: 'Deine Star Wars: Unlimited Sammlung im Griff.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'SWU Sammler – Collection Tracker' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SWU Sammler – Collection Tracker',
    description: 'Deine Star Wars: Unlimited Sammlung im Griff.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
