import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader, Instrument_Sans } from "next/font/google";
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

// Usadas solo por el nuevo lockup de marca (logo + encabezado del Dashboard)
// dentro del área del Dashboard — el resto de la app sigue en Arial/Geist
// sin ningún cambio, esto solo agrega variables CSS nuevas.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "SiteTrack",
  description: "Gestión de asistencia, estudiantes e inventario para programas educativos con una o varias sedes",
  viewport: "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} ${instrumentSans.variable} antialiased`}>
        <I18nRoot>
          {children}
        </I18nRoot>
      </body>
    </html>
  );
}
