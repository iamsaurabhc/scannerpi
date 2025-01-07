import DeployButton from "@/components/deploy-button";
import { EnvVarWarning } from "@/components/env-var-warning";
import HeaderAuth from "@/components/header-auth";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { hasEnvVars } from "@/utils/supabase/check-env-vars";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import Link from "next/link";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "ScannerPI - AI Receipt Scanner & Data Extractor",
  description: "Transform receipts into structured data with AI. Scan receipts, bills & invoices for expense tracking, sales analysis & ERP integration. Export to CSV instantly.",
  keywords: [
    "receipt scanner",
    "OCR",
    "expense tracking",
    "invoice scanner",
    "receipt OCR",
    "data extraction",
    "CSV export",
    "AI receipt processing",
    "expense management",
    "document scanning",
    "receipt digitization",
    "business automation",
    "ERP integration",
    "receipt parser",
    "digital receipts"
  ],
  authors: [{ name: "KernelPI" }],
  creator: "KernelPI",
  publisher: "KernelPI",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: "ScannerPI - AI Receipt Scanner & Data Extractor",
    description: "Transform receipts into structured data with AI. Scan receipts, bills & invoices for expense tracking, sales analysis & ERP integration. Export to CSV instantly.",
    url: defaultUrl,
    siteName: "ScannerPI",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ScannerPI - AI Receipt Scanner & Data Extractor",
    description: "Transform receipts into structured data with AI. Scan receipts, bills & invoices for expense tracking, sales analysis & ERP integration. Export to CSV instantly.",
    creator: "@kernelpi",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "your-google-verification-code",
  },
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'rgba(96, 165, 250, 0.2)' },
    { media: '(prefers-color-scheme: dark)', color: 'rgba(29, 78, 216, 0.25)' }
  ]
};

const geistSans = Geist({
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={geistSans.className} suppressHydrationWarning>
      <body className="bg-background text-foreground" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <main className="min-h-screen flex flex-col items-center">
            <div className="flex-1 w-full flex flex-col gap-20 items-center">
              <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
                <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
                  <div className="flex gap-5 items-center">
                    <Link href="/" className="font-semibold text-lg">
                      ScannerPI
                    </Link>
                  </div>
                  <div className="flex items-center gap-4">
                    {!hasEnvVars ? <EnvVarWarning /> : <HeaderAuth />}
                    <ThemeSwitcher />
                  </div>
                </div>
              </nav>
              <div className="flex flex-col gap-20 max-w-5xl p-5 w-full">
                {children}
              </div>

              <footer className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 py-16">
                <p>
                  Powered by{" "}
                  <a
                    href="https://kernelpi.com"
                    target="_blank"
                    className="font-bold hover:underline"
                    rel="noreferrer"
                  >
                    KernelPI
                  </a>
                </p>
              </footer>
            </div>
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
