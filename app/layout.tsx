import type { Metadata, Viewport } from "next";
import "@fontsource/chakra-petch/400.css";
import "@fontsource/chakra-petch/600.css";
import "@fontsource/orbitron/600.css";
import "@/original/index.css";
import localFont from "next/font/local";
const display = localFont({ src: "../node_modules/@fontsource/orbitron/files/orbitron-latin-600-normal.woff2", variable: "--font-display", display: "swap" });
const body = localFont({ src: [{ path: "../node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-400-normal.woff2", weight: "400" }, { path: "../node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-600-normal.woff2", weight: "600" }], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: "Galaxy of Consequence",
  description: "A lore-governed Saga Edition campaign console.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
