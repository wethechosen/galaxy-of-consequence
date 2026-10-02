import type { NextConfig } from "next";
const config: NextConfig = {
  // A fresh output path can work around stale OneDrive reparse points without
  // deleting any existing output. Start with the same environment value.
  // Vercel expects the standard `.next` output directory. Keep the isolated
  // local directory for the OneDrive development server to avoid stale
  // reparse-point artifacts.
  distDir: process.env.GOC_BUILD_DIR ?? (process.env.VERCEL ? ".next" : ".next-local"),
  serverExternalPackages: ["@napi-rs/canvas", "tesseract.js", "pdfjs-dist"],
};
export default config;
