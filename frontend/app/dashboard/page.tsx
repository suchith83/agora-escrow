"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, statusPillClass, type Escrow } from "@/lib/api";
import { useSession } from "@/lib/useSession";

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useSession();
  const [me, setMe] = useState<Awaited<ReturnType<typeof api.me>> | null>(null);
  const [data, setData] = useState<{ as_buyer: Escrow[]; as_seller: Escrow[] } | null>(null);
  const [tab, setTab] = useState<"as_buyer" | "as_seller">("as_buyer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    setLoading(true);
    Promise.all([api.me(), api.myEscrows()])
      .then(([m, d]) => {
        setMe(m);
        setData(d);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [authLoading, user, router]);

  if (authLoading || loading) return <div className="text-mute">Loading…</div>;
  if (!user) return null;

  const list = data ? data[tab] : [];
  const buyerCount = data?.as_buyer.length ?? 0;
  const sellerCount = data?.as_seller.length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-mute text-sm mt-1">Signed in as {user.email}</p>
      </div>

      {me && (
        <div className="card grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-mute text-xs">Your Agora wallet</div>
            <code className="text-xs break-all">{me.circle_wallet_address || "not created yet — make your first escrow"}</code>
          </div>
          <div className="text-right">
            <div className="text-mute text-xs">Balance</div>
            <div className="text-lg font-medium">{me.usdc_balance ?? "0"} USDC</div>
            {me.circle_wallet_address && (
              <a
                className="text-xs text-accent hover:underline"
                href="https://faucet.circle.com"
                target="_blank"
                rel="noreferrer"
              >
                Top up via faucet →
              </a>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2 border-b border-line">
        <TabBtn active={tab === "as_buyer"} onClick={() => setTab("as_buyer")}>
          As buyer ({buyerCount})
        </TabBtn>
        <TabBtn active={tab === "as_seller"} onClick={() => setTab("as_seller")}>
          As seller ({sellerCount})
        </TabBtn>
      </div>

      {error && <div className="card text-sm text-red-700">{error}</div>}

      <ul className="space-y-2">
        {list.length === 0 && (
          <li className="card text-sm text-mute">
            {tab === "as_buyer"
              ? "No escrows you’ve created yet."
              : "Nobody has invited you to a deliverable yet."}
          </li>
        )}
        {list.map((e) => (
          <li key={e.id} className="card">
            <Link href={`/escrow/${e.id}`} className="flex justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{e.title}</div>
                <div className="text-xs text-mute mt-1">
                  {e.amount_usdc} USDC · {new Date(e.created_at).toLocaleString()}
                </div>
              </div>
              <span className={statusPillClass(e.status)}>{e.status}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
        active ? "border-ink text-ink font-medium" : "border-transparent text-mute hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
