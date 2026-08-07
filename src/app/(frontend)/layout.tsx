import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import Script from "next/script";
import "./globals.css";
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from "@/lib/seo";
import { getRunningText } from "@/lib/running-text";
import { RunningTextProvider } from "@/components/RunningTextProvider";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "DRW Prime - Klinik Kecantikan & Perawatan Premium",
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "DRW Prime — klinik kecantikan premium dengan treatment wajah, perawatan kulit, dan layanan estetika oleh tim ahli. Booking treatment & konsultasi sekarang.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DRW Prime",
  },
  icons: {
    icon: "/drwprime-icon.ico",
    shortcut: "/drwprime-icon.ico",
    apple: [
      { url: "/apple-touch-icon-152.png", sizes: "152x152" },
      { url: "/apple-touch-icon-167.png", sizes: "167x167" },
      { url: "/apple-touch-icon-180.png", sizes: "180x180" },
    ],
  },
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "DRW Prime - Klinik Kecantikan & Perawatan Premium",
    description:
      "Klinik kecantikan premium dengan treatment wajah, perawatan kulit, dan layanan estetika oleh tim ahli.",
    locale: "id_ID",
    images: [{ url: DEFAULT_OG_IMAGE }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DRW Prime - Klinik Kecantikan & Perawatan Premium",
    description:
      "Klinik kecantikan premium dengan treatment wajah, perawatan kulit, dan layanan estetika oleh tim ahli.",
    images: [DEFAULT_OG_IMAGE],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#D4AF37",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const runningText = await getRunningText();

  return (
    <ClerkProvider>
      <html lang="id">
        <head>
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <meta name="apple-mobile-web-app-title" content="DRW Prime" />
          <script
            dangerouslySetInnerHTML={{
              __html: `
                window.__drwInstallPrompt = null;
                window.addEventListener('beforeinstallprompt', function(e){
                  e.preventDefault();
                  window.__drwInstallPrompt = e;
                  window.dispatchEvent(new Event('drw-installable'));
                });
                window.addEventListener('appinstalled', function(){
                  window.__drwInstallPrompt = null;
                  window.dispatchEvent(new Event('drw-installed'));
                });
              `,
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'Organization',
                name: 'DRW Prime',
                url: 'https://drwprime.com',
                logo: 'https://drwprime.com/drwprime-logo.png',
                description:
                  'Klinik kecantikan premium dengan treatment wajah, perawatan kulit, dan layanan estetika oleh tim ahli.',
              }),
            }}
          />
          <Script id="google-tag-manager" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','GTM-NVD6JXKN');`}
          </Script>
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              const gaScript = document.createElement('script');
              gaScript.async = true;
              gaScript.src = 'https://www.googletagmanager.com/gtag/js?id=G-Z4M7H1T0NQ';
              document.head.appendChild(gaScript);

              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-Z4M7H1T0NQ');
            `}
          </Script>
          <Script id="pwa-register" strategy="afterInteractive">
            {`
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(registration) {
                      console.log('ServiceWorker registration successful');
                    },
                    function(err) {
                      console.log('ServiceWorker registration failed: ', err);
                    }
                  );
                });
              }
            `}
          </Script>
        </head>
        <body className="antialiased">
          <noscript>
            <iframe
              src="https://www.googletagmanager.com/ns.html?id=GTM-NVD6JXKN"
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
          <RunningTextProvider initialText={runningText}>
            {children}
          </RunningTextProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
