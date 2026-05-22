"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

async function authHeader(): Promise<Record<string, string>> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      return { Authorization: `Bearer ${data.session.access_token}` };
    }
  } catch {}
  return {};
}

async function call<T>(path: string, init?: RequestInit & { auth?: boolean }): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (init?.auth !== false) {
    Object.assign(headers, await authHeader());
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers, cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  health: () => call<{ status: string }>("/health", { auth: false }),

  me: () =>
    call<{
      email: string;
      exists: boolean;
      id?: string;
      circle_wallet_address?: string | null;
      circle_wallet_id?: string | null;
      usdc_balance?: string | null;
    }>("/me"),

  myEscrows: () =>
    call<{ as_buyer: Escrow[]; as_seller: Escrow[] }>("/me/escrows"),

  listEscrows: (limit = 20) =>
    call<{ escrows: Escrow[] }>(`/escrow?limit=${limit}`, { auth: false }),

  getEscrow: (id: string) =>
    call<{
      escrow: Escrow;
      deliverables: Deliverable[];
      judgments: Judgment[];
      buyer_email: string | null;
      seller_email: string | null;
    }>(`/escrow/${id}`, { auth: false }),

  createEscrow: (body: {
    seller_email: string;
    amount_usdc: string;
    title: string;
    requirements_md: string;
  }) =>
    call<{
      escrow_id: string;
      status: string;
      escrow_wallet_address: string;
      fund_instructions: string;
    }>("/escrow/create", { method: "POST", body: JSON.stringify(body) }),

  checkFunding: (id: string) =>
    call<{ escrow_id: string; status: string; check: any }>(
      `/escrow/${id}/check-funding`,
      { method: "POST", auth: false }
    ),

  fundFromBuyer: (id: string) =>
    call<{
      escrow_id: string;
      buyer_wallet_address: string;
      buyer_balance_before: string;
      transfer_tx_id: string;
      transfer_state: string;
    }>(`/escrow/${id}/fund-from-buyer`, { method: "POST" }),

  getProfile: (email: string) =>
    call<{
      email: string;
      exists: boolean;
      id?: string;
      circle_wallet_address?: string | null;
      circle_wallet_id?: string | null;
      usdc_balance?: string | null;
    }>(`/profile?email=${encodeURIComponent(email)}`, { auth: false }),

  submit: (id: string, body: { content_text?: string; content_url?: string }) =>
    call<{ deliverable_id: string; escrow_id: string; status: string }>(
      `/escrow/${id}/submit`,
      { method: "POST", body: JSON.stringify(body) }
    ),

  judge: (id: string) =>
    call<{
      judgment_id: string;
      verdict: "release" | "refund" | "needs_review";
      reasoning: string;
      confidence: number;
      model: string;
    }>(`/escrow/${id}/judge`, { method: "POST" }),

  settle: (id: string) =>
    call<{ escrow_id: string; status: string; transfer_tx_id?: string }>(
      `/escrow/${id}/settle`,
      { method: "POST" }
    ),

  getTransaction: (txId: string) =>
    call<{
      id: string;
      state: string;
      tx_hash?: string;
      blockchain?: string;
      [k: string]: any;
    }>(`/transaction/${txId}`, { auth: false }),
};

export type EscrowStatus =
  | "pending_funding"
  | "funded"
  | "submitted"
  | "judged_release"
  | "judged_refund"
  | "released"
  | "refunded"
  | "disputed";

export interface Escrow {
  id: string;
  buyer_profile_id: string;
  seller_profile_id: string;
  amount_usdc: string;
  title: string;
  requirements_md: string;
  status: EscrowStatus;
  circle_escrow_wallet_address: string | null;
  created_at: string;
}

export interface Deliverable {
  id: string;
  escrow_id: string;
  content_text: string | null;
  content_url: string | null;
  submitted_at: string;
}

export interface Judgment {
  id: string;
  escrow_id: string;
  verdict: "release" | "refund" | "needs_review";
  reasoning: string;
  confidence: number;
  model: string;
  transfer_tx_id: string | null;
  transfer_state: string | null;
  created_at: string;
}

export function statusPillClass(status: EscrowStatus | "release" | "refund" | "needs_review"): string {
  switch (status) {
    case "pending_funding":
      return "pill-pending";
    case "funded":
    case "judged_release":
    case "judged_refund":
      return "pill-funded";
    case "submitted":
      return "pill-submitted";
    case "released":
    case "release":
      return "pill-released";
    case "refunded":
    case "refund":
      return "pill-refunded";
    default:
      return "pill";
  }
}
