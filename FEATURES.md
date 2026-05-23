# Agora — Current Features & What's Built

> Teammate-facing snapshot of what the app actually does today, so we can decide
> what to harden vs. what to add next for the Agora Agents Hackathon judging
> rubric (30% agent sophistication, 30% traction, 20% Circle tool usage, 20% innovation).

---

## TL;DR — what the app does

A two-sided **USDC escrow on Arc Testnet** with an **AI judge**.

1. **Buyer** signs in, creates a task (title, requirements in markdown, amount in USDC, seller's email).
2. The backend provisions a **dedicated Circle "vault" wallet** for that escrow.
3. **Buyer funds the vault** — either by sending USDC manually to the vault address, or by clicking *Fund from my wallet* (which pulls from the buyer's own Circle wallet).
4. Once the vault balance covers the amount, the escrow flips to `funded`.
5. **Seller** submits a deliverable (text or URL).
6. Either party can trigger the **Gemini 2.0 Flash judge**, which compares the deliverable against `requirements_md` and returns a structured verdict: `release` / `refund` / `needs_review` (with a confidence score).
7. Either party can then call **settle**, which executes the on-chain USDC transfer from the vault to the seller (release) or back to the buyer (refund).

End-to-end works on-chain. The vault wallet pattern means we don't need a custom Solidity contract for v1 — Circle Dev-Controlled Wallets + USDC transfers are the escrow.

---

## State machine

```
pending_funding ──fund──► funded ──submit──► submitted ──judge──► judged_release ──settle──► released
                                                              └─► judged_refund  ──settle──► refunded
                                                              └─► (stays submitted if needs_review)
```

Source of truth: [backend/escrow_service.py](backend/escrow_service.py)

---

## Features by layer

### Auth & profiles
- Supabase Auth (magic link / password) — frontend session token is forwarded as Bearer to FastAPI.
- `handle_new_auth_user` Postgres trigger auto-creates a `profiles` row on first sign-in.
- Backend can also lazily create profiles for unknown seller emails (admin-create user + profile).
- `ensure_user_wallet()` provisions a Circle wallet **on first need**, not eagerly — saves API quota.

### Escrow lifecycle (backend)
| Endpoint | Who | What it does |
|---|---|---|
| `POST /escrow/create` | buyer | Creates escrow row + a fresh Circle vault wallet (own wallet-set, own wallet). Status: `pending_funding`. |
| `POST /escrow/{id}/fund-from-buyer` | buyer | Pulls `amount_usdc` from buyer's Circle wallet → vault. Pre-checks balance and returns a friendly error before Circle 400. |
| `POST /escrow/{id}/check-funding` | anyone | Reads vault balance; if ≥ required, flips status to `funded`. Used as a poll fallback for manual faucet funding. |
| `POST /escrow/{id}/submit` | seller only | Inserts a `deliverables` row (text and/or URL). Status: `submitted`. Permission enforced by `actor_profile_id`. |
| `POST /escrow/{id}/judge` | either party | Calls Gemini, persists the judgment (verdict + reasoning + confidence + model). Updates escrow status to `judged_release`, `judged_refund`, or stays `submitted` if `needs_review`. |
| `POST /escrow/{id}/settle` | either party | Executes USDC transfer from vault → seller (release) or vault → buyer (refund). Records `transfer_tx_id` + `transfer_state` on the judgment row. |
| `GET /escrow/{id}` | public | Returns escrow + all deliverables + all judgments + counterparty emails. |
| `GET /me/escrows` | auth'd | Dashboard split: `{as_buyer: [...], as_seller: [...]}`. |
| `GET /escrow` | public | Recent escrows feed (default 20). |
| `GET /me` | auth'd | Profile + **live USDC balance** from Circle. |
| `GET /transaction/{tx_id}` | public | Pass-through to Circle transaction status. |

### The AI judge — [backend/judge_agent.py](backend/judge_agent.py)
- **Model:** Gemini 2.0 Flash (cheap, fast, structured-output capable).
- **Inputs:** `requirements_md` + deliverable (`content_text` and/or `content_url`).
- **Output schema (strict JSON):** `{verdict, reasoning, confidence}` where verdict ∈ `release | refund | needs_review`.
- **Defensive override:** if verdict is `release`/`refund` but `confidence < 0.5`, it's downgraded to `needs_review` — never auto-settles a borderline case.
- **Audit trail:** every judgment is written to the `judgments` table with full reasoning, model name, and (post-settle) the on-chain `transfer_tx_id`. This is our "immutable decision log" pitch.

### On-chain layer (Circle Dev-Controlled Wallets)
- One **wallet-set per user**, one **wallet-set per escrow** (the vault). Source: [backend/circle_client.py](backend/circle_client.py)
- All transfers are USDC on **Arc Testnet** — sub-second finality, ~$0.01 fees.
- No custom Solidity. Vault wallet = the escrow. Settle = one `transfer_usdc` call from vault to destination.
- Funding paths: (a) manual via Circle faucet → vault address, or (b) one-click `fund-from-buyer` which uses the buyer's own Circle wallet as the source.

### Frontend ([frontend/](frontend/))
- Next.js App Router + Tailwind on port 3001.
- Pages: landing/feed, dashboard (buyer/seller split), `/escrow/new`, `/escrow/[id]` detail.
- Uses Supabase JS for auth, forwards the access token to the FastAPI backend.

### Database — [supabase/migrations/](supabase/migrations/)
Tables: `profiles`, `escrows`, `deliverables`, `judgments`. RLS on reads. Trigger-based profile bootstrap.

### Tests — [backend/tests/](backend/tests/)
Numbered 01–05, each standalone, each verifies one layer end-to-end. `test_05_integration.py` is the **full on-chain** lifecycle (fund → submit → judge → settle).

---

## What's intentionally NOT in v1 (good candidates for Yu)

These were dropped from v1 for time but are well-scoped pickups:

1. **Custom Solidity escrow contract** — currently the "escrow" is just a Circle vault wallet that we trust ourselves not to drain. A real `Escrow.sol` (with `buyer`, `seller`, `arbiter`, `release()`, `refund()`, and event emissions) would let arcscan show the lifecycle on-chain. Pattern lives in `~/.arc-canteen/context/samples/arc-escrow/`.
2. **x402 micropayments** — pay the AI judge per call in USDC (the agent-side stack lives in the Circle developer platform). High-leverage for the "Circle tool usage" rubric.
3. **Dispute / human override UI** — `needs_review` already exists as a state but there's no UI to act on it. A "request human review" → owner-only `force_release` / `force_refund` endpoint would close the loop.
4. **Multi-deliverable / revision flow** — schema already allows multiple `deliverables` per escrow but the UI assumes one. Seller could resubmit after a `needs_review` verdict.
5. **Magic-link auth polish** — email is currently stored in localStorage in some places.
6. **CCTP** — if we want a cross-chain story (Polygon/Ethereum → Arc) we can fund vaults from any USDC chain. Bigger lift, but matches Circle's pitch.
7. **MCP server wrapper** — expose `create_escrow`/`submit`/`judge`/`settle` as MCP tools so a Claude/Cursor agent can run an entire escrow flow. Pattern: see DealARC.
8. **Multi-agent judge** — currently one Gemini call. A two-agent "advocate + judge" or "Gemini trader vs. Gemini auditor" setup directly answers the 30% agentic-sophistication rubric. Pattern: see CNote (Claude vs. GPT).
9. **Arcscan deep links** — UI should link `transfer_tx_id` → `https://testnet.arcscan.app/tx/<hash>` for credibility.
10. **Live demo / faucet drip** — for the traction rubric, a public deployment + a "click here to demo with $0.10" button would generate real on-chain txs.

---

## Where to look first

| Question | File |
|---|---|
| How does the escrow lifecycle flow? | [backend/escrow_service.py](backend/escrow_service.py) |
| How do we talk to Circle? | [backend/circle_client.py](backend/circle_client.py) |
| How does the AI judge work? | [backend/judge_agent.py](backend/judge_agent.py) |
| What does the API expose? | [backend/main.py](backend/main.py) |
| What's the DB schema? | [supabase/migrations/20260520000001_initial_escrow_schema.sql](supabase/migrations/) |
| How is auth wired up? | [backend/auth.py](backend/auth.py) + [frontend/middleware.ts](frontend/middleware.ts) |
| Frontend pages | [frontend/app/](frontend/app/) |
| End-to-end test (canonical example of the full flow) | [backend/tests/test_05_integration.py](backend/tests/test_05_integration.py) |

---

## Running locally

See [README.md](README.md) for the full quickstart. Short version:

```bash
# backend
cd backend && uv venv --python 3.13 && source .venv/bin/activate
uv pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# frontend (new terminal)
cd frontend && npm install && npm run dev  # :3001
```

You need: `CIRCLE_API_KEY`, `CIRCLE_ENTITY_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY` in `backend/.env`, and `NEXT_PUBLIC_SUPABASE_*` in `frontend/.env.local`.
