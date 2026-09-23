import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const manrope = localFont({
  src: "./Manrope-Variable.ttf",
  display: "swap",
  variable: "--font-manrope",
  weight: "200 800",
});

export const metadata: Metadata = {
  title: "Care Workspace  | MediTrust360",
  description: "A calm, connected workspace for MediTrust360 clinicians.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={manrope.variable}>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
