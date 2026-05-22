"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  api,
  statusPillClass,
  type Escrow,
  type Deliverable,
  type Judgment,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";

const ARC_EXPLORER = "https://testnet.arcscan.app/address";
const ARC_TX = "https://testnet.arcscan.app/tx";

export default function EscrowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useSession();
  const [me, setMe] = useState<Awaited<ReturnType<typeof api.me>> | null>(null);
  const [escrow, setEscrow] = useState<Escrow | null>(null);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [judgments, setJudgments] = useState<Judgment[]>([]);
  const [buyerEmail, setBuyerEmail] = useState<string | null>(null);
  const [sellerEmail, setSellerEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api.getEscrow(id);
      setEscrow(data.escrow);
      setDeliverables(data.deliverables);
      setJudgments(data.judgments);
      setBuyerEmail(data.buyer_email);
      setSellerEmail(data.seller_email);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    api.me().then(setMe).catch(() => {});
  }, [user]);

  async function runAction(name: string, fn: () => Promise<unknown>) {
    setActionBusy(name);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setActionBusy(null);
    }
  }

  if (loading || authLoading) return <div className="text-mute">Loading…</div>;
  if (error && !escrow) return <div className="card text-red-700">{error}</div>;
  if (!escrow) return <div>Not found.</div>;

  const isBuyer = me?.id === escrow.buyer_profile_id;
  const isSeller = me?.id === escrow.seller_profile_id;
  const isParty = isBuyer || isSeller;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{escrow.title}</h1>
          <span className={statusPillClass(escrow.status)}>{escrow.status}</span>
        </div>
        <div className="text-mute text-sm mt-1">{escrow.amount_usdc} USDC</div>
        <div className="text-xs text-mute mt-2 flex gap-4">
          <span>
            Buyer: <code className="text-ink">{buyerEmail}</code>
            {isBuyer && <span className="ml-1 text-accent">(you)</span>}
          </span>
          <span>
            Seller: <code className="text-ink">{sellerEmail}</code>
            {isSeller && <span className="ml-1 text-accent">(you)</span>}
          </span>
        </div>
      </div>

      {!user && (
        <div className="card text-sm space-y-2">
          <p>
            You’re viewing this escrow as a guest. To submit a deliverable or fund
            the vault, sign in.
          </p>
          <Link
            href={`/login?next=/escrow/${id}`}
            className="btn-primary inline-block"
          >
            Sign in
          </Link>
        </div>
      )}

      {user && !isParty && (
        <div className="card text-sm text-mute">
          You’re signed in as {user.email}, but you’re not the buyer or seller on
          this escrow. You can view it but can’t take actions.
        </div>
      )}

      <section className="card space-y-2">
        <div className="text-sm font-medium">Vault address</div>
        <code className="block text-xs break-all bg-line/30 p-2 rounded">
          {escrow.circle_escrow_wallet_address}
        </code>
        {escrow.circle_escrow_wallet_address && (
          <a
            className="text-xs text-accent hover:underline"
            href={`${ARC_EXPLORER}/${escrow.circle_escrow_wallet_address}`}
            target="_blank"
            rel="noreferrer"
          >
            View on Arc explorer →
          </a>
        )}
      </section>

      <section className="card space-y-2">
        <div className="text-sm font-medium">Requirements</div>
        <pre className="text-sm whitespace-pre-wrap font-sans">{escrow.requirements_md}</pre>
      </section>

      {/* ============ Action panel — gated by status + role ============ */}
      <section className="space-y-3">
        {escrow.status === "pending_funding" && (
          isBuyer ? (
            <FundCard
              amount={escrow.amount_usdc}
              vault={escrow.circle_escrow_wallet_address || ""}
              me={me}
              actionBusy={actionBusy}
              onAutoFund={() =>
                runAction("autofund", async () => {
                  await api.fundFromBuyer(id);
                  await new Promise((r) => setTimeout(r, 4000));
                  await api.checkFunding(id);
                })
              }
              onCheck={() => runAction("fund", () => api.checkFunding(id))}
            />
          ) : (
            <WaitingCard text="Waiting for the buyer to fund the vault." />
          )
        )}

        {escrow.status === "funded" && (
          isSeller ? (
            <SubmitDeliverableCard
              onSubmit={(body) => runAction("submit", () => api.submit(id, body))}
              busy={actionBusy === "submit"}
            />
          ) : (
            <WaitingCard text="Vault funded. Waiting for the seller to submit a deliverable." />
          )
        )}

        {escrow.status === "submitted" && isParty && (
          <div className="card space-y-3">
            <div className="text-sm font-medium">Step 3 — Run the AI judge</div>
            <p className="text-sm text-mute">
              Either party can trigger the judge. Gemini reads the requirements
              and the deliverable, then returns a verdict.
            </p>
            <button
              className="btn-primary"
              disabled={actionBusy === "judge"}
              onClick={() => runAction("judge", () => api.judge(id))}
            >
              {actionBusy === "judge" ? "Judging…" : "Run AI judge"}
            </button>
          </div>
        )}

        {(escrow.status === "judged_release" || escrow.status === "judged_refund") && isParty && (
          <div className="card space-y-3">
            <div className="text-sm font-medium">
              Step 4 — Settle on-chain
              <span className="text-mute font-normal">
                {" "}(verdict: {escrow.status === "judged_release" ? "release to seller" : "refund to buyer"})
              </span>
            </div>
            <button
              className="btn-primary"
              disabled={actionBusy === "settle"}
              onClick={() => runAction("settle", () => api.settle(id))}
            >
              {actionBusy === "settle" ? "Settling…" : "Execute transfer"}
            </button>
          </div>
        )}

        {(escrow.status === "released" || escrow.status === "refunded") && (
          <div className="card text-sm">
            Final state: <strong>{escrow.status}</strong>. Funds have been transferred on Arc.
            See the AI judgment below for the on-chain transaction link.
          </div>
        )}
      </section>

      {deliverables.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Deliverables</h2>
          {deliverables.map((d) => (
            <div key={d.id} className="card space-y-1">
              {d.content_text && (
                <pre className="text-sm whitespace-pre-wrap font-sans">{d.content_text}</pre>
              )}
              {d.content_url && (
                <a
                  className="text-xs text-accent hover:underline"
                  href={d.content_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {d.content_url}
                </a>
              )}
              <div className="text-xs text-mute">{new Date(d.submitted_at).toLocaleString()}</div>
            </div>
          ))}
        </section>
      )}

      {judgments.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">AI judgments</h2>
          {judgments.map((j) => (
            <div key={j.id} className="card space-y-1">
              <div className="flex items-center justify-between">
                <span className={statusPillClass(j.verdict)}>{j.verdict}</span>
                <span className="text-xs text-mute">
                  confidence {(j.confidence * 100).toFixed(0)}% · {j.model}
                </span>
              </div>
              <p className="text-sm">{j.reasoning}</p>
              {j.transfer_tx_id && <TransferLink txId={j.transfer_tx_id} state={j.transfer_state} />}
            </div>
          ))}
        </section>
      )}

      {error && <div className="card text-sm text-red-700">{error}</div>}
    </div>
  );
}

function WaitingCard({ text }: { text: string }) {
  return <div className="card text-sm text-mute">⏳ {text}</div>;
}

function TransferLink({ txId, state }: { txId: string; state: string | null }) {
  const [txHash, setTxHash] = useState<string | null>(null);
  const [latestState, setLatestState] = useState(state);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      setPolling(true);
      for (let i = 0; i < 20; i++) {
        if (cancelled) return;
        try {
          const tx = await api.getTransaction(txId);
          if (tx.tx_hash) {
            setTxHash(tx.tx_hash);
            setLatestState(tx.state);
            break;
          }
          setLatestState(tx.state);
          if (tx.state === "FAILED" || tx.state === "CANCELLED") break;
        } catch {}
        await new Promise((r) => setTimeout(r, 4000));
      }
      setPolling(false);
    }
    poll();
    return () => {
      cancelled = true;
    };
  }, [txId]);

  return (
    <div className="text-xs text-mute pt-2 border-t border-line/60">
      <div>
        Circle tx id: <code className="text-ink">{txId}</code>
      </div>
      <div>State: <strong>{latestState}</strong>{polling && " (polling…)"}</div>
      {txHash && (
        <a
          className="text-accent hover:underline mt-1 inline-block"
          href={`${ARC_TX}/${txHash}`}
          target="_blank"
          rel="noreferrer"
        >
          View on-chain transaction on Arc explorer →
        </a>
      )}
    </div>
  );
}

function FundCard({
  amount,
  vault,
  me,
  actionBusy,
  onAutoFund,
  onCheck,
}: {
  amount: string;
  vault: string;
  me: Awaited<ReturnType<typeof api.me>> | null;
  actionBusy: string | null;
  onAutoFund: () => void;
  onCheck: () => void;
}) {
  const balance = me?.usdc_balance ? parseFloat(me.usdc_balance) : 0;
  const required = parseFloat(amount);
  const hasEnough = balance >= required;

  return (
    <div className="card space-y-4">
      <div className="text-sm font-medium">Step 1 — Fund the vault ({amount} USDC)</div>

      <div className="space-y-2">
        <div className="text-sm font-semibold">Option A — Fund from your wallet (one-click)</div>
        <div className="text-xs text-mute space-y-1">
          <div>
            Your wallet:{" "}
            <code className="text-ink">{me?.circle_wallet_address || "—"}</code>
          </div>
          <div>
            Balance:{" "}
            <span className={hasEnough ? "text-green-700" : "text-red-700"}>
              {me?.usdc_balance ?? "—"} USDC
            </span>{" "}
            · need {amount}
          </div>
          {!hasEnough && me?.circle_wallet_address && (
            <a
              className="text-accent hover:underline inline-block mt-1"
              href={`https://faucet.circle.com`}
              target="_blank"
              rel="noreferrer"
            >
              Top up via faucet → paste {me.circle_wallet_address}
            </a>
          )}
        </div>
        <button
          className="btn-primary"
          disabled={actionBusy === "autofund" || !hasEnough}
          onClick={onAutoFund}
        >
          {actionBusy === "autofund" ? "Funding…" : `Fund vault with ${amount} USDC`}
        </button>
      </div>

      <div className="border-t border-line pt-3 space-y-2">
        <div className="text-sm font-semibold">Option B — Send manually</div>
        <p className="text-xs text-mute">
          Send {amount} USDC on Arc Testnet from any wallet to the vault address:
        </p>
        <code className="block text-xs break-all bg-line/30 p-2 rounded">{vault}</code>
        <button
          className="btn-outline"
          disabled={actionBusy === "fund"}
          onClick={onCheck}
        >
          {actionBusy === "fund" ? "Checking…" : "I’ve sent it — check balance"}
        </button>
      </div>
    </div>
  );
}

function SubmitDeliverableCard({
  onSubmit,
  busy,
}: {
  onSubmit: (body: { content_text?: string; content_url?: string }) => void;
  busy: boolean;
}) {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  return (
    <div className="card space-y-3">
      <div className="text-sm font-medium">Step 2 — Submit deliverable</div>
      <textarea
        rows={4}
        placeholder="Paste deliverable text here (optional if you provide a URL)"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <input
        type="url"
        placeholder="Or paste a link to the deliverable (optional)"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <button
        className="btn-primary"
        disabled={busy || (!text && !url)}
        onClick={() => onSubmit({ content_text: text || undefined, content_url: url || undefined })}
      >
        {busy ? "Submitting…" : "Submit deliverable"}
      </button>
    </div>
  );
}
