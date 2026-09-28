import type { Metadata, Viewport } from "next";
import { Lora, Montserrat } from "next/font/google";
import "./globals.css";

const sans = Montserrat({
  variable: "--font-sans",
  subsets: ["latin"],
});

const serif = Lora({
  variable: "--font-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MRS Leaderboard",
  description:
    "Phase 1 track-only lead funnel for Miller Roofing Solutions LLC / Mrs Roofers — Jacksonville insurance-restoration roofing.",
};

export const viewport: Viewport = {
  themeColor: "#0a343c",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} h-full`}>
      <body className="min-h-full font-sans antialiased">{children}</body>
    </html>
  );
}
