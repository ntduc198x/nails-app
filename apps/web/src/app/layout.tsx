import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Geist_Mono, Inter, Montserrat } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "600", "700"],
  style: ["normal", "italic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://chambeauty.io.vn"),
  title: {
    default: "Chạm Beauty | Nail Art & Beauty Studio",
    template: "%s | Chạm Beauty",
  },
  description:
    "Chạm Beauty - Luxury nail art studio, đặt lịch chăm sóc móng và làm đẹp với trải nghiệm tinh tế, chỉn chu và cao cấp.",
  applicationName: "Chạm Beauty",
  keywords: ["Chạm Beauty", "nail art", "nail studio", "đặt lịch nails", "beauty studio", "chăm sóc móng"],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "https://chambeauty.io.vn",
    siteName: "Chạm Beauty",
    title: "Chạm Beauty | Nail Art & Beauty Studio",
    description:
      "Luxury nail art studio - đặt lịch chăm sóc móng và làm đẹp với trải nghiệm tinh tế, chỉn chu và cao cấp.",
    locale: "vi_VN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Chạm Beauty | Nail Art & Beauty Studio",
    description:
      "Luxury nail art studio - đặt lịch chăm sóc móng và làm đẹp với trải nghiệm tinh tế, chỉn chu và cao cấp.",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" data-scroll-behavior="smooth">
      <body
        suppressHydrationWarning
        className={`${inter.variable} ${montserrat.variable} ${cormorant.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
