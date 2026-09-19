import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Galaxy of Consequence",
  description: "A lore-governed Saga Edition campaign console.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
