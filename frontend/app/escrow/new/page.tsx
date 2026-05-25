"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useSession } from "@/lib/useSession";

export default function NewEscrowPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useSession();
  const [form, setForm] = useState({
    seller_email: "",
    amount_usdc: "0.10",
    title: "",
    requirements_md: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [knownEmails, setKnownEmails] = useState<{ email: string; display_name: string | null }[]>([]);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    api
      .listProfiles()
      .then((d) => setKnownEmails(d.profiles))
      .catch(() => setKnownEmails([]));
  }, []);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.createEscrow(form);
      router.push(`/escrow/${res.escrow_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }

  if (authLoading) return <div className="text-mute">Loading…</div>;
  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create escrow</h1>
        <p className="text-mute text-sm mt-1">
          You ({user.email}) are the buyer. Invite a seller by email — they’ll see
          this escrow on their dashboard after they sign in.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-sm font-medium block mb-1">Seller email</label>
          <input
            type="email"
            required
            list="known-emails"
            value={form.seller_email}
            onChange={(e) => update("seller_email", e.target.value)}
            placeholder="seller@example.com — pick or type a new one"
          />
          <datalist id="known-emails">
            {knownEmails
              .filter((p) => p.email !== user?.email)
              .map((p) => (
                <option key={p.email} value={p.email}>
                  {p.display_name || p.email}
                </option>
              ))}
          </datalist>
          <p className="text-xs text-mute mt-1">
            Suggestions come from people already on Agora — but you can invite anyone by typing a new email.
          </p>
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Amount (USDC)</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={form.amount_usdc}
            onChange={(e) => update("amount_usdc", e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Title</label>
          <input
            type="text"
            required
            maxLength={200}
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="e.g. Logo design for AgoraPay"
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">
            Requirements (Markdown)
          </label>
          <textarea
            required
            rows={8}
            value={form.requirements_md}
            onChange={(e) => update("requirements_md", e.target.value)}
            placeholder="Be specific. The AI judge will compare the deliverable against this."
          />
          <p className="text-xs text-mute mt-1">
            Tip: list explicit, checkable criteria. Vague requirements → ambiguous verdicts.
          </p>
        </div>

        {error && (
          <div className="card text-sm text-red-700 whitespace-pre-wrap">{error}</div>
        )}

        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Creating…" : "Create escrow"}
        </button>
      </form>
    </div>
  );
}
