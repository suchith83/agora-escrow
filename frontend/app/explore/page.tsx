"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, statusPillClass, type Escrow } from "@/lib/api";

export default function ExplorePage() {
  const [escrows, setEscrows] = useState<Escrow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listEscrows(20)
      .then((d) => setEscrows(d.escrows))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight mb-1">Live escrows</h1>
        <p className="text-mute text-sm">
          Every escrow created on Agora, newest first. Click any to see the
          on-chain transfers and the AI judge’s reasoning.
        </p>
      </section>

      <section>
        {loading && <div className="text-mute text-sm">Loading…</div>}
        {error && (
          <div className="card text-sm text-red-700">
            Couldn’t reach API: {error}
          </div>
        )}
        {!loading && !error && escrows.length === 0 && (
          <div className="card text-sm text-mute">No escrows yet. Be the first.</div>
        )}
        <ul className="space-y-2">
          {escrows.map((e) => (
            <li key={e.id} className="card">
              <Link href={`/escrow/${e.id}`} className="flex justify-between items-start gap-4">
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
      </section>
    </div>
  );
}
