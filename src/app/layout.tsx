import type { Metadata, Viewport } from "next";
import { Instrument_Sans } from "next/font/google";
import localFont from "next/font/local";
import { Footer } from "@/components/shell/Footer";
import { Header } from "@/components/shell/Header";
import { PageWipeProvider } from "@/components/shell/PageWipe";
import { SmoothScroll } from "@/components/shell/SmoothScroll";
import { SealSprite } from "@/components/ui/Seal";
import { site } from "@/content/site";
import { MODE_SCRIPT } from "@/lib/mode-script";
import "./globals.css";

const instrument = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-instrument",
});

// LXGW WenKai, cut down to the characters the site uses. Rebuild with `npm run fonts`.
const wenkai = localFont({
  src: "../fonts/wenkai-subset.woff2",
  display: "swap",
  variable: "--font-wenkai",
  weight: "400",
});

const title = `${site.name.display} (${site.name.chinese})`;

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: title, template: `%s | ${site.name.display}` },
  description: site.description,
  applicationName: site.name.display,
  authors: [{ name: site.name.display, url: site.url }],
  creator: site.name.display,
  keywords: [site.name.display, site.name.legal, site.name.chinese, "software engineering", "Auckland", "Hamilton", "Zhengzhou"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: site.url,
    siteName: site.name.display,
    title,
    description: site.description,
    locale: "en_NZ",
  },
  twitter: { card: "summary_large_image", title, description: site.description },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${instrument.variable} ${wenkai.variable}`} suppressHydrationWarning>
      <head>
        {/* Sets the colour mode before first paint. See src/lib/mode-script.ts. */}
        <script dangerouslySetInnerHTML={{ __html: MODE_SCRIPT }} />
      </head>
      <body>
        <SealSprite />
        <SmoothScroll>
          <PageWipeProvider>
            <a href="#main" className="sr-only-focusable">
              Skip to content
            </a>
            <Header />
            <main id="main" tabIndex={-1} className="outline-none">
              {children}
            </main>
            <Footer />
          </PageWipeProvider>
        </SmoothScroll>
      </body>
    </html>
  );
}
