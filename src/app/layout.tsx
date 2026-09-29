import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const sans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Miller Roofing Solutions | Lead Board",
  icons: { icon: "/brand/mrs-logo.png" },
  description:
    "Private lead and follow-up workspace for Miller Roofing Solutions LLC, Jacksonville.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} h-full`}>
      <body className="min-h-full font-sans antialiased">{children}</body>
    </html>
  );
}
