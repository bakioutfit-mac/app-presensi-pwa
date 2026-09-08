import './globals.css';
import Providers from '@/components/Providers';

export const metadata = {
  title: '3 PILLAR MANAGEMENT - Presensi Staf LazyBloom',
  description: 'Aplikasi PWA Presensi Staf LazyBloom 3 Pillar Management dengan Face & Geofencing Verification',
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
