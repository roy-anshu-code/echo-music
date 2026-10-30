import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Echo — Your Music Library",
  description: "Your personal music library, wherever you go.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
