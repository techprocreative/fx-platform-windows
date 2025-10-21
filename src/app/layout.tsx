import type { Metadata } from "next";
import { Inter } from "next/font/google";
import dynamic from "next/dynamic";
import "../styles/globals.css";
import { DefaultSkipLinks } from "../components/accessibility/SkipLink";
import { InteractionTracker } from "../components/client/InteractionTracker";

const ClientProvider = dynamic(
  () =>
    import("../components/providers/ClientProvider").then(
      (mod) => mod.ClientProvider,
    ),
  { ssr: false },
);

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NexusTrade - AI-Powered Trading Platform",
  description: "Empower your trading with institutional-grade technology",
  keywords: [
    "trading",
    "forex",
    "cryptocurrency",
    "automated trading",
    "AI",
    "machine learning",
  ],
  icons: "/favicon.ico",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <DefaultSkipLinks />
        <InteractionTracker />
        <ClientProvider>{children}</ClientProvider>
      </body>
    </html>
  );
}
