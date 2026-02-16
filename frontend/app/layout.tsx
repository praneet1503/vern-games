import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { HealthCheck } from "@/components/HealthCheck";
import CreditsFooter from "@/components/CreditsFooter";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vern Games Player",
  description: "Play. Compete. Enjoy.",
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {apiBaseUrl && <HealthCheck apiBaseUrl={apiBaseUrl} />}
        {children}
        <CreditsFooter apiBaseUrl={apiBaseUrl} />
      </body>
    </html>
  );
}
