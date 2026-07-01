import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Velora",
  description: "Velora is a personal stock analysis search app.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
