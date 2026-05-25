import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { HeaderNav } from "@/components/HeaderNav";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Verdikt — AI Escrow on Arc",
  description: "USDC escrow with an AI judge, settled on Arc testnet in seconds.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", inter.variable)}>
      <body>
        <header className="border-b border-line">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="font-semibold tracking-tight">
              Verdikt <span className="text-mute font-normal">· AI Escrow</span>
            </Link>
            <HeaderNav />
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-4 py-8">{children}</main>
        <footer className="border-t border-line mt-16">
          <div className="max-w-3xl mx-auto px-4 py-4 text-xs text-mute">
            Hackathon build · Arc Testnet · USDC
          </div>
        </footer>
      </body>
    </html>
  );
}
