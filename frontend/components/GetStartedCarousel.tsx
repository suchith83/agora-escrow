"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  LogIn,
  Coins,
  PenLine,
  Wallet,
  Gavel,
  type LucideIcon,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type GetStartedStep = {
  n: number;
  title: string;
  description: string;
  icon: LucideIcon;
  href?: string;
  external?: boolean;
  linkLabel?: string;
};

export const GET_STARTED_STEPS: GetStartedStep[] = [
  {
    n: 1,
    title: "Sign in with your email",
    description:
      "Magic link only — no password, no MetaMask. Your Circle wallet is created automatically.",
    icon: LogIn,
    href: "/login",
    linkLabel: "Sign in",
  },
  {
    n: 2,
    title: "Get free testnet USDC",
    description:
      "Open the Arc faucet, paste your wallet address from the dashboard, and request USDC.",
    icon: Coins,
    href: "https://faucet.circle.com",
    external: true,
    linkLabel: "Arc faucet",
  },
  {
    n: 3,
    title: "Create an escrow",
    description:
      "Pick seller, amount, title, and requirements. Agora creates a dedicated vault wallet.",
    icon: PenLine,
    href: "/escrow/new",
    linkLabel: "New escrow",
  },
  {
    n: 4,
    title: "Fund the vault",
    description:
      "On the escrow page, click Fund from my wallet. USDC moves into the vault in one step.",
    icon: Wallet,
  },
  {
    n: 5,
    title: "Submit, judge, settle",
    description:
      "Seller posts work. Run the AI judge. USDC releases or refunds with auditable reasoning.",
    icon: Gavel,
    href: "/explore",
    linkLabel: "See examples",
  },
];

const TILTS = ["-rotate-2", "rotate-1", "-rotate-1", "rotate-2", "-rotate-1.5"] as const;

function CurvyArrowRight({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 80 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-16 h-10 shrink-0 text-mute/80", className)}
      aria-hidden
    >
      <path
        d="M4 24 C20 8, 36 40, 52 24 S 68 8, 76 24"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="4 6"
      />
      <path
        d="M68 18 L76 24 L68 30"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GetStartedStepCard({
  step,
  tilt,
  isActive,
}: {
  step: GetStartedStep;
  tilt: string;
  isActive?: boolean;
}) {
  const Icon = step.icon;
  const body = (
    <Card
      className={cn(
        "w-[17.5rem] h-[17.5rem] shrink-0 rounded-3xl border border-line/60 bg-white",
        "shadow-lg transition-all duration-500 ease-out",
        "hover:shadow-xl hover:-translate-y-2 hover:border-ink/20",
        tilt,
        isActive && "shadow-xl -translate-y-2 border-ink/25 ring-2 ring-ink/5 scale-[1.02]"
      )}
    >
      <CardHeader className="p-5 pb-2">
        <div className="flex items-start justify-between gap-2 mb-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-ink text-white text-base font-bold shadow-sm">
            {step.n}
          </span>
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-line/50">
            <Icon className="h-5 w-5 text-ink" strokeWidth={1.5} />
          </span>
        </div>
        <CardTitle className="text-base leading-snug">{step.title}</CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-0 text-sm text-mute leading-relaxed flex flex-col justify-between h-[calc(100%-7rem)]">
        <p className="line-clamp-4">{step.description}</p>
        {step.href && step.linkLabel && (
          <span className="inline-flex items-center text-xs font-semibold text-ink mt-3">
            {step.linkLabel}
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </span>
        )}
      </CardContent>
    </Card>
  );

  if (!step.href) return body;

  if (step.external) {
    return (
      <a
        href={step.href}
        target="_blank"
        rel="noopener noreferrer"
        className="block shrink-0"
      >
        {body}
      </a>
    );
  }

  return (
    <Link href={step.href} className="block shrink-0">
      {body}
    </Link>
  );
}

export function GetStartedCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const stepCount = GET_STARTED_STEPS.length;

  const scrollToIndex = useCallback((index: number) => {
    const container = scrollRef.current;
    if (!container) return;
    const targets = container.querySelectorAll<HTMLElement>("[data-snap-step]");
    const el = targets[index];
    if (el) {
      el.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
    setActiveIndex(index);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % stepCount;
        const container = scrollRef.current;
        if (container) {
          const targets = container.querySelectorAll<HTMLElement>(
            "[data-snap-step]"
          );
          targets[next]?.scrollIntoView({
            behavior: "smooth",
            inline: "center",
            block: "nearest",
          });
        }
        return next;
      });
    }, 5000);
    return () => window.clearInterval(id);
  }, [stepCount]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const onScroll = () => {
      const targets = Array.from(
        container.querySelectorAll<HTMLElement>("[data-snap-step]")
      );
      if (!targets.length) return;
      const center = container.scrollLeft + container.clientWidth / 2;
      let closest = 0;
      let minDist = Infinity;
      targets.forEach((el, i) => {
        const elCenter = el.offsetLeft + el.offsetWidth / 2;
        const dist = Math.abs(center - elCenter);
        if (dist < minDist) {
          minDist = dist;
          closest = i;
        }
      });
      setActiveIndex(closest);
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="space-y-6">
      <div
        ref={scrollRef}
        className="flex items-center gap-2 overflow-x-auto snap-x snap-mandatory px-6 sm:px-10 py-10 hide-scrollbar scroll-smooth"
      >
        {GET_STARTED_STEPS.map((step, i) => (
          <div key={step.n} className="flex items-center shrink-0">
            <div data-snap-step className="snap-center px-1">
              <GetStartedStepCard
                step={step}
                tilt={TILTS[i]}
                isActive={activeIndex === i}
              />
            </div>
            {i < GET_STARTED_STEPS.length - 1 && (
              <CurvyArrowRight className="mx-2 sm:mx-4 max-[480px]:hidden" />
            )}
          </div>
        ))}
      </div>

      {/* Step dots + hint */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-2" role="tablist" aria-label="Steps">
          {GET_STARTED_STEPS.map((step, i) => (
            <button
              key={step.n}
              type="button"
              role="tab"
              aria-selected={activeIndex === i}
              aria-label={`Step ${step.n}: ${step.title}`}
              onClick={() => scrollToIndex(i)}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                activeIndex === i
                  ? "w-8 bg-ink"
                  : "w-2 bg-line hover:bg-mute/40"
              )}
            />
          ))}
        </div>
        <p className="text-xs text-mute">
          Swipe the cards — they advance automatically every few seconds
        </p>
      </div>
    </div>
  );
}
