"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, ShieldCheck, Zap, Users, Radio } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GetStartedCarousel } from "@/components/GetStartedCarousel";

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
      <section className="relative text-center space-y-6 pt-8 pb-4 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          aria-hidden
        >
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[28rem] w-[28rem] rounded-full bg-accent/10 blur-3xl" />
          <div className="absolute left-[20%] top-[30%] h-48 w-48 rounded-full bg-amber-400/15 blur-3xl" />
          <div className="absolute right-[15%] top-[40%] h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />
        </div>
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
        <Card className="landing-card shadow-none">
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

        <Card className="landing-card shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-mute">
              Active now
            </CardTitle>
            <Radio className="h-4 w-4 text-mute" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Card className="landing-card">
            <CardHeader>
              <ShieldCheck className="h-6 w-6 text-ink mb-3" strokeWidth={1.5} />
              <CardTitle className="text-base flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 bg-amber-500 rounded-full" />
                Lock USDC into a vault
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-mute leading-relaxed">
              The backend provisions a fresh Circle wallet for every escrow.
              Buyer funds it in one click. Funds sit there until a verdict.
            </CardContent>
          </Card>
          <Card className="landing-card">
            <CardHeader>
              <Bot className="h-6 w-6 text-ink mb-3" strokeWidth={1.5} />
              <CardTitle className="text-base flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 bg-amber-500 rounded-full" />
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
          <Card className="landing-card">
            <CardHeader>
              <Zap className="h-6 w-6 text-amber-500 mb-3" strokeWidth={1.5} />
              <CardTitle className="text-base flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 bg-amber-500 rounded-full" />
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

      {/* How to get started — carousel */}
      <section className="space-y-6 -mx-4 sm:mx-0">
        <div className="text-center space-y-2 px-4">
          <h2 className="text-3xl font-semibold tracking-tight text-ink">
            Get started in 5 minutes
          </h2>
          <p className="text-mute text-sm max-w-lg mx-auto">
            First time on crypto? Follow the flow — testnet only, no real
            money.
          </p>
        </div>
        <GetStartedCarousel />
      </section>

      {/* Footer CTA */}
      <section className="text-center space-y-4 py-10 px-4 bg-line/30 rounded-2xl border border-line/50 shadow-sm">
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
