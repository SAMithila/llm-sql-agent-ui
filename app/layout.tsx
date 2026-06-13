import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LLM SQL Agent",
  description: "Ask any question about your database in plain English",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
