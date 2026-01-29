import type { Metadata } from 'next';
import { JetBrains_Mono, Space_Mono } from 'next/font/google';
import './globals.css';

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono-primary',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
});

const spaceMono = Space_Mono({
  variable: '--font-mono-display',
  subsets: ['latin'],
  weight: ['400', '700'],
});

export const metadata: Metadata = {
  title: 'Lendflow',
  description: 'Bank Loan Risk Analysis',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${jetbrainsMono.variable} ${spaceMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
