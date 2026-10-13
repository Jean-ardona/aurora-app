import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aurora — A City That Does Not Exist Yet",
  description: "A city designed with the people who will live in it, from day one.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      {/* style on body ensures #0A0A0A before any JS/CSS loads — prevents flash */}
      <body style={{ background: '#0A0A0A' }}>{children}</body>
    </html>
  );
}
