import './globals.css';
import Providers from '@/components/Providers';

export const metadata = {
  title: '3 PILLAR MANAGEMENT - Presensi Staf',
  description: 'Aplikasi PWA Presensi Staf 3 Pillar Management (LazyBloom • Deru Ombak • Sea Cafe)',
  openGraph: {
    title: '3 PILLAR MANAGEMENT - Presensi Staf',
    description: 'Aplikasi PWA Presensi Staf 3 Pillar Management (LazyBloom • Deru Ombak • Sea Cafe)',
    siteName: '3 Pillar Management',
    type: 'website',
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '3 Pillar Presensi',
  },
};

export const viewport = {
  themeColor: '#F97316',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="antialiased min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
