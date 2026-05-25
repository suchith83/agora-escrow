"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  ShieldCheck,
  Zap,
  Users,
  Radio,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { api } from "@/lib/api";
import { usePresence } from "@/lib/usePresence";

export default function Home() {
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const activeNow = usePresence("lobby");

  useEffect(() => {
    api
      .metricsUsersTotal()
      .then((d) => setTotalUsers(d.total))
      .catch(() => setTotalUsers(null));
  }, []);

  return (
    <div className="space-y-20">
      {/* Hero */}
      <section className="text-center space-y-6 pt-8">
        <div className="text-xs uppercase tracking-[0.2em] text-mute">
          Built on Arc &nbsp;·&nbsp; USDC-native &nbsp;·&nbsp; AI-judged
        </div>
        <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight leading-[1.05] text-ink">
          USDC escrow.
          <br />
          Judged by AI.
          <br />
          Settled on Arc in seconds.
        </h1>
        <p className="text-mute max-w-xl mx-auto pt-2">
          Lock USDC into a fresh vault per deal. The seller submits work. A
          Groq-powered judge reads the requirements vs the deliverable and
          auto-releases the funds or refunds — with reasoning you can audit.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
          <Button asChild size="lg">
            <Link href="/escrow/new">
              Create escrow <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/explore">Explore live escrows</Link>
          </Button>
        </div>
      </section>

      {/* Live metrics */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-mute">
              Total users
            </CardTitle>
            <Users className="h-4 w-4 text-mute" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-semibold tabular-nums text-ink">
              {totalUsers === null ? "—" : totalUsers.toLocaleString()}
            </div>
            <p className="text-xs text-mute mt-2">
              Registered profiles on Agora
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-mute">
              Active now
            </CardTitle>
            <Radio className="h-4 w-4 text-mute" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <div className="text-4xl font-semibold tabular-nums text-ink">
                {activeNow || "—"}
              </div>
            </div>
            <p className="text-xs text-mute mt-2">
              People viewing Agora right now
            </p>
          </CardContent>
        </Card>
      </section>

      {/* How it works */}
      <section className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-semibold tracking-tight text-ink">
            Three steps. No middlemen.
          </h2>
          <p className="text-mute text-sm">
            Powered by Circle Dev-Controlled Wallets, Groq, and Arc Testnet.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="shadow-none">
            <CardHeader>
              <ShieldCheck className="h-6 w-6 text-ink mb-3" strokeWidth={1.5} />
              <CardTitle className="text-base flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 bg-amber-500" />
                Lock USDC into a vault
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-mute leading-relaxed">
              The backend provisions a fresh Circle wallet for every escrow.
              Buyer funds it in one click. Funds sit there until a verdict.
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardHeader>
              <Bot className="h-6 w-6 text-ink mb-3" strokeWidth={1.5} />
              <CardTitle className="text-base flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 bg-amber-500" />
                AI judges the work
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-mute leading-relaxed">
              Groq{" "}
              <code className="text-xs bg-line/40 px-1 rounded">
                llama-3.3-70b
              </code>{" "}
              reads the buyer’s requirements vs the seller’s deliverable and
              returns{" "}
              <code className="text-xs bg-line/40 px-1 rounded">release</code>,{" "}
              <code className="text-xs bg-line/40 px-1 rounded">refund</code>,
              or{" "}
              <code className="text-xs bg-line/40 px-1 rounded">
                needs_review
              </code>{" "}
              — with reasoning.
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardHeader>
              <Zap className="h-6 w-6 text-amber-500 mb-3" strokeWidth={1.5} />
              <CardTitle className="text-base flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 bg-amber-500" />
                Sub-second settlement
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-mute leading-relaxed">
              Arc Testnet finalizes in &lt; 1s with ~$0.01 fees. The vault
              transfers USDC to the seller (release) or back to the buyer
              (refund) automatically.
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="text-center space-y-4 py-10 -mx-4 px-4 bg-line/30 rounded-lg">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          Try it with $0.10 of testnet USDC.
        </h2>
        <p className="text-mute text-sm max-w-md mx-auto">
          You’ll need a Circle testnet wallet (auto-created on first sign-in)
          and a few USDC from the Arc faucet. Takes about a minute.
        </p>
        <Button asChild size="lg">
          <Link href="/escrow/new">
            Create your first escrow <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </section>
    </div>
  );
}
