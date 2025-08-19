import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import I18nRoot from "@/components/I18nRoot";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Orchestra Attendance Tracker",
  description: "Sistema de registro de asistencia para orquestas",
  viewport: "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <I18nRoot>
          {children}
        </I18nRoot>
      </body>
    </html>
  );
}
