import type { NextConfig } from "next";

// Statischer Export: die Seite besteht nur aus HTML/CSS/JS-Dateien (Ordner `out/`)
// und läuft ohne Server – ideal für Cloudflare Pages (unbegrenzte statische Aufrufe).
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
