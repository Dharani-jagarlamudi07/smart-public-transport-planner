import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";

export const metadata: Metadata = {
  title: "Smart Public Transport Route Planner",
  description: "AI-assisted public transport route planning with maps, alternatives, saved routes, alerts, and analytics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}