import type { Metadata, Viewport } from 'next';
import Track from './track';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://shanewetzel.xyz'),
  title: 'Shane Wetzel',
  description: 'Selected work, photographs, and a visual universe of ongoing references.',
  openGraph: {
    title: 'Shane Wetzel',
    description: 'Selected work, photographs, and a visual universe of ongoing references.',
    url: 'https://shanewetzel.xyz',
    siteName: 'Shane Wetzel',
    locale: 'en',
    type: 'website',
    images: [
      {
        url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/digital/altstadt.jpg`,
        width: 2400,
        height: 1600,
        alt: 'Shane Wetzel — photography',
      },
    ],
  },
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🦠</text></svg>",
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#F5F5F7',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <link
          rel="preconnect"
          href={process.env.NEXT_PUBLIC_SUPABASE_URL}
          crossOrigin="anonymous"
        />
        {children}
        <Track />
      </body>
    </html>
  );
}
