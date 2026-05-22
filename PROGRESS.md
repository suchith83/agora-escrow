# Agora Hackathon — Build Progress

**Project:** AI-Adjudicated Escrow on Arc
**Plan file:** `~/.claude/plans/to-help-you-get-memoized-parasol.md`
**Date started:** 2026-05-20

---

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Backend skeleton — Circle wallet creation + balance | ✅ DONE |
| 2 | Supabase schema (4 tables) | ✅ written — awaiting `db push` |
| 3 | FastAPI escrow endpoints (create/submit/judge/release) | ✅ written |
| 4 | Gemini AI judge agent | ✅ written |
| 5 | Full integration test (end-to-end) | ✅ **PASSED on-chain 2026-05-21** |
| 6 | Next.js frontend | ✅ built — `npm run build` passes |
| 7 | README / per-component test docs | ✅ done |

---

## Phase 1 — Backend skeleton ✅

**Goal:** Verify the Circle Dev-Controlled Wallets Python SDK works against the user's already-registered Circle entity, on Arc Testnet.

### What was built
- [backend/requirements.txt](backend/requirements.txt) — pinned deps
- [backend/.env.example](backend/.env.example) — env var template
- [backend/config.py](backend/config.py) — settings loader (reads `.env` from backend/ first, falls back to project root)
- [backend/circle_client.py](backend/circle_client.py) — wrapper for Circle SDK with these functions:
  - `create_wallet_set(name)` → returns walletSetId
  - `create_wallet(wallet_set_id)` → returns `{id, address, blockchain}` (SCA wallet on Arc Testnet)
  - `get_balance(wallet_id)` → returns `{usdc: Decimal, raw: [...]}`
  - `transfer_usdc(from_wallet_id, to_address, amount_usdc)` → returns `{transaction_id, state}`
  - `get_transaction(transaction_id)` → returns transaction dict
  - `usdc_to_atoms()` / `atoms_to_usdc()` helpers (USDC = 6 decimals)
- [backend/tests/test_01_circle.py](backend/tests/test_01_circle.py) — standalone test (creates wallet set + wallet + reads balance)

### Setup (already done)
```bash
cd /Users/suchithkoduru/Desktop/suchith/Agora/backend
rm -rf .venv
uv venv --python 3.13
source .venv/bin/activate
uv pip install -r requirements.txt
# copied root .env into backend/.env (config.py reads both anyway)
```

### Test command
```bash
cd /Users/suchithkoduru/Desktop/suchith/Agora/backend
source .venv/bin/activate
python tests/test_01_circle.py
```

### Test run — 2026-05-20
✅ **PASSED** — wallet created on Circle Arc Testnet:

```
wallet_set_id:  1a81767d-ed6e-57e4-93ac-950dff7de5e9
wallet_id:      26bc134b-b057-5e63-ac84-c11d049097c9
address:        0x43450331b572530eb87a5236921797181b8baf36
blockchain:     ARC-TESTNET
USDC balance:   0
```

### How to verify yourself
- Circle Console → Wallets: https://console.circle.com — should see the wallet set & wallet listed
- Arc testnet explorer: https://testnet.arcscan.app/address/0x43450331b572530eb87a5236921797181b8baf36
- Fund this address with testnet USDC: https://faucet.circle.com (select Arc Testnet)

### Quirks discovered (for future ref)
1. **Circle Python SDK package:** Use `circle-developer-controlled-wallets==9.3.3` (not 2.x — that's a different/older fork with pydantic v1).
2. **Python version:** Must use Python 3.13. Python 3.14 has no pydantic-core wheels yet.
3. **SDK auto-fills `entity_secret_ciphertext` and `idempotency_key`** — don't pass them manually.
4. **Response objects use pydantic oneOf union types.** Access via `resp.data.<field>.actual_instance.<attr>`. For example:
   - Wallet set: `resp.data.wallet_set.actual_instance.id`
   - Wallet:     `resp.data.wallets[0].actual_instance.id` / `.address` / `.blockchain`
5. **Transfer method name:** `create_developer_transaction_transfer` (not `create_transfer_transaction_for_developer` which is the TS name).
6. **USDC ERC-20 contract on Arc Testnet:** `0x3600000000000000000000000000000000000000` (set in `.env` as `USDC_CONTRACT_ADDRESS`).

### Environment variables loaded
| Var | Source | Purpose |
|---|---|---|
| `CIRCLE_API_KEY` | already in root `.env` | Circle SDK auth |
| `CIRCLE_ENTITY_SECRET` | already in root `.env` | Circle SDK signing (registered via `test.py`) |
| `ARC_RPC_URL` | from `arc-canteen login`, falls back to `JSON-RPC-endpoint` in root `.env` | direct chain reads |
| `USDC_CONTRACT_ADDRESS` | default `0x3600...0000` | ERC-20 USDC on Arc |
| `ARC_BLOCKCHAIN` | default `ARC-TESTNET` | Circle blockchain ID |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | need to fill in `.env` | for Phase 2/3 |
| `GEMINI_API_KEY` | need to fill in `.env` | for Phase 4 |

---

## Phase 2 — Supabase schema ✅ (written; needs `db push`)

### Files
- [supabase/migrations/20260520000001_initial_escrow_schema.sql](supabase/migrations/20260520000001_initial_escrow_schema.sql) — the migration
- [backend/supabase_client.py](backend/supabase_client.py) — service-role client wrapper
- [backend/tests/test_02_supabase.py](backend/tests/test_02_supabase.py) — standalone test

### Schema (4 tables)

**profiles** — links Supabase auth users to Circle wallets
- `id` (uuid PK), `auth_user_id` (FK → auth.users), `email`, `display_name`
- `circle_wallet_set_id`, `circle_wallet_id`, `circle_wallet_address` (filled lazily)
- Auto-created via trigger when a new auth user signs up

**escrows** — the main entity
- `id`, `buyer_profile_id` (FK), `seller_profile_id` (FK)
- `amount_usdc` numeric(20,6), `title`, `requirements_md`
- `status` enum: `pending_funding | funded | submitted | judged_release | judged_refund | released | refunded | disputed`
- `circle_escrow_wallet_set_id`, `circle_escrow_wallet_id`, `circle_escrow_wallet_address` (the vault wallet)

**deliverables** — seller's submissions
- `id`, `escrow_id` (FK), `content_text`, `content_url`, `submitted_at`

**judgments** — AI verdict + on-chain transfer info
- `id`, `escrow_id` (FK), `deliverable_id` (FK nullable)
- `verdict` enum: `release | refund | needs_review`
- `reasoning` text, `confidence` numeric(4,3), `model` (default `gemini-2.0-flash`)
- `transfer_tx_id`, `transfer_state`, `transfer_tx_hash` (filled after Circle transfer)

### RLS
- All 4 tables have RLS enabled with permissive `select for all`. Writes only via backend service-role key.

### Realtime
- `escrows` and `judgments` are added to the `supabase_realtime` publication so the frontend can subscribe.

### How to apply the migration

**Option A — Supabase Dashboard SQL editor:**
1. Open https://supabase.com/dashboard/project/cajvqzexeqgcrhxqccef/sql/new
2. Paste the contents of `supabase/migrations/20260520000001_initial_escrow_schema.sql`
3. Run

**Option B — Supabase CLI:**
```bash
cd /Users/suchithkoduru/Desktop/suchith/Agora
npx supabase db push
```
(Project is already linked from earlier session.)

### How to test
1. Add to `backend/.env`:
   ```
   SUPABASE_URL=https://cajvqzexeqgcrhxqccef.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<your service_role key from Supabase dashboard → Settings → API>
   ```
2. Run:
   ```bash
   cd backend && source .venv/bin/activate
   python tests/test_02_supabase.py
   ```
3. Expected: creates a fake auth user → trigger auto-creates profile → inserts test escrow → cleans up.

---

## Phase 3 — FastAPI escrow endpoints ✅

### Files
- [backend/models.py](backend/models.py) — pydantic request/response models
- [backend/escrow_service.py](backend/escrow_service.py) — core business logic (no HTTP)
- [backend/main.py](backend/main.py) — FastAPI app + CORS
- [backend/tests/test_03_api.py](backend/tests/test_03_api.py) — endpoint smoke test (no on-chain)

### Endpoints
| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | liveness check |
| POST | `/escrow/create` | creates buyer/seller profiles + wallets + escrow vault wallet; returns vault address to fund |
| POST | `/escrow/{id}/check-funding` | re-polls Circle balance; flips status to `funded` when sufficient |
| POST | `/escrow/{id}/submit` | seller submits deliverable (text and/or URL) |
| POST | `/escrow/{id}/judge` | runs Gemini judge; writes verdict + reasoning |
| POST | `/escrow/{id}/settle` | executes on-chain transfer (release to seller OR refund to buyer) based on last verdict |
| GET | `/escrow/{id}` | full detail (escrow + deliverables + judgments) |
| GET | `/escrow?limit=20` | public feed |

### State machine
```
pending_funding → funded → submitted → judged_release → released
                                    ↘
                                     judged_refund → refunded
```
`needs_review` keeps the escrow in `submitted` (no auto-settle).

### Run the server
```bash
cd /Users/suchithkoduru/Desktop/suchith/Agora/backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000
```
Open http://localhost:8000/docs for auto-generated Swagger UI.

### Test the endpoints (smoke)
With server running in another terminal:
```bash
cd backend && source .venv/bin/activate
python tests/test_03_api.py
```
This creates an escrow + vault wallet but does NOT fund or settle.

---

## Phase 4 — Gemini AI judge ✅

### Files
- [backend/judge_agent.py](backend/judge_agent.py) — Gemini wrapper with structured JSON output
- [backend/tests/test_04_judge.py](backend/tests/test_04_judge.py) — 3-scenario test

### Behavior
- Model: `gemini-2.0-flash`
- Response schema enforced: `{verdict: "release"|"refund"|"needs_review", reasoning: str, confidence: float}`
- Defensive clamping: if model returns `release/refund` but confidence < 0.5, downgrade to `needs_review`
- System prompt explains the role, common release reasons, common refund reasons

### Test it
```bash
cd backend && source .venv/bin/activate
python tests/test_04_judge.py
```
Runs 3 scenarios: good haiku (expect release), "lol pay me" (expect refund), vague design promise (expect needs_review).

---

## Phase 5 — End-to-end integration test ✅

### File
- [backend/tests/test_05_integration.py](backend/tests/test_05_integration.py)

### What it tests (full lifecycle, hits Arc testnet)
1. Create escrow (auto-provisions buyer/seller profiles + wallets)
2. Transfer USDC from your funded wallet → escrow vault
3. Poll `check-funding` until status = `funded`
4. Submit good deliverable
5. Run AI judge (expects `release`)
6. Settle on-chain → seller receives USDC
7. Poll Circle until tx is `CONFIRMED`/`COMPLETE`, print Arc explorer link

### Prerequisite
You need a funded Circle wallet on Arc Testnet. Use the wallet created in Phase 1:
```
WALLET_ID:      26bc134b-b057-5e63-ac84-c11d049097c9
ADDRESS:        0x43450331b572530eb87a5236921797181b8baf36
```
Fund it: https://faucet.circle.com → Arc Testnet → paste address → request USDC

### Run
```bash
# 1. start server
cd backend && source .venv/bin/activate
uvicorn main:app --reload --port 8000

# 2. in another terminal
cd backend && source .venv/bin/activate
export FUNDING_WALLET_ID=26bc134b-b057-5e63-ac84-c11d049097c9
export FUNDING_WALLET_ADDRESS=0x43450331b572530eb87a5236921797181b8baf36
python tests/test_05_integration.py
```
Takes ~2 minutes (Circle confirmations).

### ✅ First successful end-to-end run — 2026-05-21

**Lifecycle executed:**
| Step | Detail |
|---|---|
| Funding wallet | `0x43450331b572530eb87a5236921797181b8baf36` (20 USDC balance) |
| Escrow id | `efec3d9b-63e7-4a84-beb3-0cbb5d98113c` |
| Vault address | `0x60a949abb2df07dd731cddf5a16ad137abbd8c90` |
| Amount | 0.10 USDC |
| Buyer email | `agora-int-buyer-1779365712@example.com` |
| Seller email | `agora-int-seller-1779365712@example.com` |
| Fund transfer tx | `e5de6b37-0394-5ed5-b31e-30ae58bc57d8` (state INITIATED → ready) |
| Judge verdict | `release` (confidence 1.0) |
| Judge reasoning | "The deliverable is a haiku about USDC that meets the requirements." |
| Release tx | `655af41b-185b-5034-bdfc-94f005bdc64e` (state COMPLETE) |
| Final status | `released` |

**Links:**
- Vault on Arc explorer: https://testnet.arcscan.app/address/0x60a949abb2df07dd731cddf5a16ad137abbd8c90
- Escrow detail (when server running): http://localhost:8000/escrow/efec3d9b-63e7-4a84-beb3-0cbb5d98113c

**Fixes applied during this test:**
1. **`google-genai` SDK swap** — judge_agent.py was rewritten to use `from google import genai` instead of `import google.generativeai as genai`. Updated `requirements.txt`.
2. **Native USDC vs ERC-20 on Arc** — discovered Arc Testnet USDC is the *native* token (18 decimals, `isNative: True`), not an ERC-20. Removed `token_address` from transfer requests.
3. **Blockchain enum wrapping** — `CreateTransferTransactionForDeveloperRequest.blockchain` requires a `CreateTransferTransactionForDeveloperRequestBlockchain` wrapper around `TransferBlockchain.ARC_MINUS_TESTNET`, not a raw string.

**This satisfies the "real on-chain transaction" judging criterion. 🎯**

---

## Phase 6 — Next.js frontend ✅

### Stack
- Next.js 14 (App Router) + React 18 + Tailwind CSS
- TypeScript
- Plain `fetch` against the FastAPI backend (`NEXT_PUBLIC_API_BASE_URL`)
- No auth yet — dashboard uses email stored in localStorage (Phase 6.5: magic-link auth)

### Files
```
frontend/
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts
├── postcss.config.js
├── .env.local.example
├── lib/api.ts                          ← typed wrapper for all backend endpoints
└── app/
    ├── globals.css                     ← tailwind + custom .pill / .btn classes
    ├── layout.tsx                      ← header + nav + footer
    ├── page.tsx                        ← landing + public feed
    ├── dashboard/page.tsx              ← my escrows (email-based)
    └── escrow/
        ├── new/page.tsx                ← create escrow form
        └── [id]/page.tsx               ← full lifecycle UI (fund → submit → judge → settle)
```

### Pages
| Route | Purpose |
|---|---|
| `/` | Landing pitch + list of all recent escrows |
| `/escrow/new` | Form: buyer email, seller email, amount, title, requirements |
| `/escrow/[id]` | The main interactive view — shows current state and the next action button (fund / submit / judge / settle) based on `status`. Renders deliverables, judgments, vault address with Arc explorer link |
| `/dashboard` | Recent escrows (filterable by email, stored in localStorage) |

### Run locally
```bash
# 1. backend must be running (port 8000)
cd /Users/suchithkoduru/Desktop/suchith/Agora/backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000

# 2. frontend
cd /Users/suchithkoduru/Desktop/suchith/Agora/frontend
cp .env.local.example .env.local      # fill in Supabase URL + anon key
npm install                            # (already done)
npm run dev                            # http://localhost:3001
```

### Verify
- Build passes: `npm run build` ✅
- 4 routes generated: `/`, `/dashboard`, `/escrow/new`, `/escrow/[id]`
- Full lifecycle clickable in the browser: create → fund (manual) → check funding → submit deliverable → run judge → settle

### Deployment to Vercel (later)
- Push the `frontend/` folder to GitHub
- Import into Vercel (root directory = `frontend`)
- Set env vars: `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Backend (Python) needs separate hosting — Railway/Render free tier works

---

## Phase 7 — Docs ✅

---

## Stage 2 (post-MVP) — what's next

| # | Feature | Status |
|---|---|---|
| 8 | Magic-link auth (Supabase) | ✅ working end-to-end |
| 9 | Role-aware UI: "as buyer" / "as seller" dashboard splits; detail page hides irrelevant actions | ✅ working |
| 10 | Vercel + backend deploy (Vercel + Render) | 🚧 in progress |
| 11 | **Bet on the verdict** — prediction-market layer where anyone can stake USDC on a public escrow's outcome. Yu's territory. | ⏳ pending |
| 12 | Hackathon submission (video, README polish, `arc-canteen update-product`/`update-traction`) | ⏳ pending |

### Stage 2.8/9 — Auth + role-aware UI (DONE 2026-05-22)

**Backend:**
- [backend/auth.py](backend/auth.py) — verifies Supabase JWTs. Supports both legacy HS256 (env secret) and new ES256/RS256 (auto-fetched from JWKS endpoint).
- [backend/main.py](backend/main.py) — endpoints now use `Depends(current_user)`:
  - `/me` — returns authenticated profile + live USDC balance
  - `/me/escrows` — `{as_buyer: [...], as_seller: [...]}`
  - `/escrow/create` — buyer = authenticated user (not from form)
  - `/escrow/{id}/submit` — gated to seller_profile_id
  - `/escrow/{id}/fund-from-buyer` — gated to buyer_profile_id
- [backend/supabase_client.py](backend/supabase_client.py) — fresh client per call (avoids stale HTTP/2 connection errors)

**Frontend:**
- [frontend/middleware.ts](frontend/middleware.ts), [frontend/lib/supabase/{client,server}.ts](frontend/lib/supabase/) — Supabase SSR helpers
- [frontend/app/login/page.tsx](frontend/app/login/page.tsx) — magic-link signin
- [frontend/app/auth/callback/route.ts](frontend/app/auth/callback/route.ts) — token exchange
- [frontend/lib/useSession.ts](frontend/lib/useSession.ts), [frontend/components/HeaderNav.tsx](frontend/components/HeaderNav.tsx) — session UI
- [frontend/lib/api.ts](frontend/lib/api.ts) — all calls auto-attach `Authorization: Bearer <jwt>`
- [frontend/app/dashboard/page.tsx](frontend/app/dashboard/page.tsx) — role-tabs (As buyer / As seller), live wallet balance card
- [frontend/app/escrow/[id]/page.tsx](frontend/app/escrow/[id]/page.tsx) — action panel gated by both status AND role; "waiting on …" cards when it's the other party's turn

**Confirmed working in local browser test:** signin as buyer → create escrow → fund (one-click from own wallet) → switch to seller account → see escrow in "As seller" tab → submit deliverable → judge → settle. Real on-chain release tx confirmed.

**Gotchas discovered:**
1. **Supabase asymmetric JWTs** — new projects use ES256, not HS256. Use JWKS endpoint, not shared secret. Install `PyJWT[crypto]`.
2. **`api.ts` is "use client"** — landing page (originally Server Component) had to be converted to client.
3. **HTTP/2 `ReadError [Errno 35]`** — fixed by recreating Supabase client per request instead of caching.

### Why these in this order
- **Auth first** — without it we can't share the URL meaningfully (no notion of "my" escrows).
- **Role-aware UI** rides on auth — once we know who's logged in, buyer/seller views fall out for free.
- **Deploy** is the gating step for getting real users / traction → judging score.
- **Betting layer** is the trading angle Yu wants, but only worth building once auth + deploy are in place (otherwise nobody can bet).
