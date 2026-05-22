import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { HeaderNav } from "@/components/HeaderNav";

export const metadata: Metadata = {
  title: "Agora — AI Escrow on Arc",
  description: "USDC escrow with an AI judge, settled on Arc testnet in seconds.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-line">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="font-semibold tracking-tight">
              Agora <span className="text-mute font-normal">· AI Escrow</span>
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
