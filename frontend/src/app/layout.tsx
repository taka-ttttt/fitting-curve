import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Material Curve Fitter",
  description: "金属材料の応力–ひずみ曲線を硬化則へフィッティングします。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
