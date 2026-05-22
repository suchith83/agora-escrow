# Hackathon Submission Guide — Agora Agents (Circle × Arc)

## What judges score (Canteen rubric)

| Weight | Dimension | How we score |
|---|---|---|
| 30% | **Agentic sophistication** | Gemini judge with structured JSON output, defensive verdict downgrading, full reasoning trace persisted to DB. Multi-step decision: requirements vs deliverable → verdict + confidence → on-chain transfer. |
| 30% | **Traction** | Public Vercel URL, real magic-link signups, on-chain Arc Testnet transactions. Every escrow creates 1 fund tx + 1 settle tx = 2 on-chain txns per real use. |
| 20% | **Circle tool usage** | Circle Developer-Controlled Wallets (3 wallets per escrow: buyer + seller + vault), Circle USDC transfers on Arc, Circle entity secret registered. |
| 20% | **Innovation** | AI judge with persistent reasoning trace, role-aware UX, novel use case (sub-$1 freelance escrow viable only because Arc gas is ~$0.01). |

---

## What to actually submit

### 1. `arc-canteen update-product`
Run this **after deploying to Vercel** to log a product update. It's interactive — fill in the prompts.

```bash
arc-canteen update-product
```
Prep this content to paste:

```
Agora — AI-adjudicated USDC escrow on Arc Testnet.

Two parties lock USDC into an escrow vault (Circle Modular Wallet). Seller submits a deliverable.
Gemini 2.0 Flash reads the buyer's requirements vs the deliverable and returns
{verdict, reasoning, confidence}. On 'release' the backend triggers a Circle USDC transfer
from the vault to the seller; on 'refund', back to the buyer. Sub-second settlement.

Live demo: <vercel URL>
GitHub: <github URL>
Loom: <loom URL>

Stack: Next.js + Tailwind on Vercel, FastAPI on Render, Supabase Postgres+Auth,
Circle Dev-Controlled Wallets, Gemini 2.0 Flash, Arc Testnet RPC.
```

### 2. `arc-canteen update-traction`
Run this **after you get at least 1 person other than yourself to use it**. Run it again whenever the count grows.

```bash
arc-canteen update-traction
```
Prep this content:

```
N users have signed up via magic link.
N escrows created end-to-end through the UI.
N on-chain transactions on Arc Testnet (fund + settle for each).

Sample on-chain settlement: https://testnet.arcscan.app/tx/<hash>
Sample vault address:      https://testnet.arcscan.app/address/<addr>
```

### 3. Loom / demo video (2-3 min)

Outline:
1. **(0:00–0:20)** "Two parties want to do a freelance gig but don't trust each other. They lock USDC into a vault. AI judges the work. Settled on Arc in seconds for ~$0.01."
2. **(0:20–1:00)** Open the live app → sign in with magic link → create escrow with seller email + requirements
3. **(1:00–1:30)** Show your wallet → click "Fund vault" → vault funded; switch accounts to the seller → submit deliverable
4. **(1:30–2:00)** Click "Run AI judge" → show Gemini's verdict + reasoning appearing → click "Settle" → on-chain explorer link appears, click it to show the Arc Testnet tx confirmed
5. **(2:00–2:30)** Quick architecture overview slide: Next.js → FastAPI → (Circle Wallets, Supabase, Gemini, Arc RPC)

Record with [Loom](https://loom.com) (free tier is fine). Keep it under 3 min.

### 4. Submission portal
Per CLAUDE.md, the portal URL isn't published yet — aadi said it'd appear in the event sidebar. Check:
- The Canteen Discord (announcement channel)
- The event dashboard on https://thecanteenapp.com
- `arc-canteen status` to see whether the CLI has a pointer

Typical hackathon portals want:
- **Project name:** Agora
- **One-liner:** "AI-adjudicated USDC escrow on Arc"
- **Demo URL:** your Vercel link
- **Source URL:** your GitHub link
- **Video URL:** the Loom
- **Team:** Suchith Koduru, Yu (+ roles)
- **Tech tags:** Circle Modular Wallets, Arc Testnet, Gemini, Next.js, FastAPI, Supabase

---

## Pre-submission checklist

- [ ] Live Vercel URL works in incognito
- [ ] Live magic-link signup works end-to-end
- [ ] At least one full lifecycle completed on live (escrow → fund → submit → judge → settle)
- [ ] At least one Arc explorer link saved (release or refund tx)
- [ ] GitHub repo is public, has README with quickstart + architecture diagram
- [ ] `.env`, `.env.local`, `register/`, `.venv/`, `node_modules/` are NOT in the repo
- [ ] Loom video uploaded and unlisted/public link copied
- [ ] `arc-canteen update-product` submitted
- [ ] `arc-canteen update-traction` submitted (run once per real signup wave)
- [ ] Portal form filled out (check Discord/sidebar for URL)

---

## Sharing to get traction

Post in:
- Canteen Discord (most important — judges and other hackers are there)
- X / Twitter (tag @circle, @arc_network)
- Hacker News / Reddit r/ethdev (low priority, optional)
- Personal network (text 5 friends, ask them to try one escrow each)

Each real-user signup = 1 real escrow = 2 on-chain txns. Aim for 10+ users = 20+ txns = strong traction story.
