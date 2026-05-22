# Agora — AI-Adjudicated USDC Escrow on Arc

**Hackathon submission for the Agora Agents Hackathon (Circle × Arc).**

Two parties lock USDC into an escrow on Arc Testnet. The seller submits a deliverable.
A Gemini-powered judge reads the requirements vs the deliverable and auto-releases the
USDC to the seller or refunds the buyer. Sub-second settlement, ~$0.01 fees.

✅ **End-to-end on-chain demo working as of 2026-05-21.**
See [PROGRESS.md](PROGRESS.md) for the detailed build log.

---

## Architecture

```
┌────────────────────────┐
│  Next.js frontend      │  http://localhost:3001
│  (App Router + Tailwind)│
└────────────┬───────────┘
             │ REST
             ▼
┌────────────────────────┐
│  FastAPI backend       │  http://localhost:8000
│  (Python 3.13)         │
└─────┬───────┬──────┬───┘
      │       │      │
      │       │      └─► Gemini 2.0 Flash (judge)
      │       │
      │       └────────► Circle Dev-Controlled Wallets API
      │                  (creates escrow vault wallets, executes USDC transfers on Arc Testnet)
      │
      └────────────────► Supabase (Postgres + Auth)
                         tables: profiles, escrows, deliverables, judgments
```

---

## Repo layout

```
Agora/
├── README.md                    ← you are here
├── PROGRESS.md                  ← detailed phase-by-phase build log + test results
├── CLAUDE.md                    ← agent-facing context (for Claude Code)
├── backend/
│   ├── main.py                  ← FastAPI app
│   ├── escrow_service.py        ← lifecycle logic
│   ├── circle_client.py         ← Circle Modular Wallets wrapper
│   ├── judge_agent.py           ← Gemini judge
│   ├── supabase_client.py
│   ├── config.py
│   ├── models.py
│   ├── requirements.txt
│   └── tests/
│       ├── test_01_circle.py        # Circle wallet creation
│       ├── test_02_supabase.py      # Schema + triggers
│       ├── test_03_api.py           # FastAPI smoke test
│       ├── test_04_judge.py         # Gemini judge
│       └── test_05_integration.py   # FULL end-to-end (on-chain)
├── frontend/
│   ├── app/
│   │   ├── page.tsx                  # landing + feed
│   │   ├── dashboard/page.tsx
│   │   └── escrow/{new,[id]}/page.tsx
│   ├── lib/api.ts
│   └── package.json
└── supabase/
    └── migrations/
        └── 20260520000001_initial_escrow_schema.sql
```

---

## Quickstart

### 1. Prerequisites
- Python 3.13 (use `uv` for venv: `uv venv --python 3.13`)
- Node 20+ (`npm` works fine)
- A Circle developer account ([console.circle.com](https://console.circle.com)) — API key + entity secret
- A Supabase project — URL + service role key
- A Gemini API key (free: https://aistudio.google.com/apikey)
- The Supabase CLI (`npx supabase` works without install)

### 2. Configure
```bash
# Backend
cp backend/.env.example backend/.env
# fill in CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET, SUPABASE_*, GEMINI_API_KEY

# Frontend
cp frontend/.env.local.example frontend/.env.local
# fill in NEXT_PUBLIC_SUPABASE_*
```

### 3. Apply DB migration
```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

### 4. Install + run backend
```bash
cd backend
uv venv --python 3.13
source .venv/bin/activate
uv pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 5. Install + run frontend (separate terminal)
```bash
cd frontend
npm install
npm run dev
# open http://localhost:3001
```

---

## Test each component individually

Each test is **standalone** and verifies one layer end-to-end. Run them in order.

| # | Test | What it verifies | Prereqs |
|---|------|------------------|---------|
| 1 | `python backend/tests/test_01_circle.py` | Circle SDK creates wallet sets + wallets on Arc Testnet, reads balances | CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET in `.env` |
| 2 | `python backend/tests/test_02_supabase.py` | Schema tables exist, RLS allows reads, `handle_new_auth_user` trigger auto-creates profiles, escrow insert works | Migration applied, SUPABASE_* in `.env` |
| 3 | `python backend/tests/test_03_api.py` | FastAPI endpoints reachable, escrow creation provisions Circle wallets correctly | Server running on `:8000`, all `.env` set |
| 4 | `python backend/tests/test_04_judge.py` | Gemini returns structured verdicts for good/bad/ambiguous deliverables | GEMINI_API_KEY in `.env` |
| 5 | `python backend/tests/test_05_integration.py` | **Full on-chain lifecycle**: fund vault → submit → judge → release/refund | All of the above + a funded Circle wallet (export FUNDING_WALLET_ID + FUNDING_WALLET_ADDRESS) |

### How to fund a Circle wallet on Arc Testnet
1. Create one via `python backend/tests/test_01_circle.py` (prints address)
2. Go to https://faucet.circle.com → Network: **Arc Testnet** → paste address → request USDC
3. Wait ~10 seconds, verify with:
   ```bash
   python -c "from circle_client import get_balance; print(get_balance('<wallet_id>'))"
   ```

---

## How the AI judge works

`backend/judge_agent.py` calls Gemini 2.0 Flash with a strict JSON schema:

```json
{
  "verdict": "release | refund | needs_review",
  "reasoning": "2-4 sentence explanation",
  "confidence": 0.0
}
```

Defensive logic: if `verdict` is `release` or `refund` but `confidence < 0.5`, it's
downgraded to `needs_review` so a borderline case doesn't auto-trigger a transfer.

Every judgment is persisted to `judgments` table with the full reasoning trace,
giving us an **immutable on-chain-linkable decision log** — a key hackathon talking point.

---

## Why Arc

- **USDC as native gas** — one currency for users to think about
- **~$0.01 fees** — micro-escrows (sub-$1 freelance gigs) economically viable
- **Sub-second finality** — UX feels like a Stripe payment, not a blockchain transaction
- **EVM-compatible** — we can swap to a real on-chain escrow contract later without changing the rest of the stack

---

## What's intentionally NOT in v1

- Custom Solidity escrow contract (using Circle's USDC transfers + a dedicated vault wallet per escrow)
- Magic-link auth (email is stored in localStorage)
- Multi-chain (Arc Testnet only)
- Disputes / human override beyond `needs_review` flag
- x402 micropayments (mentioned in future-work section of submission)

---

## Acknowledgements

- [Arc canteen CLI](https://github.com/the-canteen-dev/ARC-cli) for the testnet RPC
- [Circle Modular Wallets](https://developers.circle.com/wallets/modular) for the wallet/transfer primitives
- The 5 Arc sample codebases in `~/.arc-canteen/context/samples/` — especially `arc-escrow` for the AI-judge pattern
