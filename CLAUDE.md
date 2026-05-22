# CLAUDE.md — Agora Agents Hackathon Project Context

## About this project

This is a hackathon submission for the **Agora Agents Hackathon** (May 11–25, 2026), hosted by **Canteen** in partnership with **Circle**, built on **Arc** — Circle's stablecoin-native L1 blockchain.

The user, Suchith, is an AI/full-stack engineer experienced with multi-agent systems, LangGraph, FastAPI, React, MCP servers, and Python. He is a **complete beginner to Web3/blockchain/Solidity**. His teammate Yu is also a Web3 beginner. The project direction is still being decided — currently exploring the prediction-markets RFB and AI-agent-as-trader patterns.

**This early phase is exploratory.** The user wants to understand what's possible with the Arc + Circle stack before committing to a specific build. Do not push ahead to implementation prematurely — explain, demo, and iterate.

---

## The stack — what you must know

### Arc (the chain)
- **EVM-compatible L1** built by Circle. Same Solidity, same tooling (Foundry, Hardhat, ethers.js, viem, web3.py) as Ethereum.
- **Native currency = USDC.** There is no separate gas token. Transaction fees are paid in USDC, always ~$0.01, predictable.
- **Sub-second deterministic finality.** Transactions confirm in under 1 second.
- **Testnet block explorer:** https://testnet.arcscan.app
- **Contract verification:** https://testnet.arcscan.app/contract-verification (use `forge verify-contract` for Foundry projects)

### Circle developer platform (tools layered on top of Arc)
- **Circle Wallets** — managed wallets via API. The safe way to give an AI agent its own wallet without exposing private keys. Supports developer-controlled and user-controlled modes, spending limits, whitelists.
- **CCTP (Cross-Chain Transfer Protocol)** — official Circle protocol for moving USDC between chains (Ethereum ↔ Arc ↔ Polygon ↔ Solana etc.) without sketchy bridges.
- **Gateway** — unified balance view across chains, sub-500ms cross-chain transfers.
- **App Kit** — pre-built UI/SDK components: Bridge, Swap, Send, Unified Balance.
- **x402** — micropayment standard for agent-to-agent and agent-to-API payments (one hacker, `jacks0n`, already shipped x402 nanopayments).

### The Polymarket V2 architectural pattern (relevant for prediction-market RFBs)
- Polymarket V2 added a `bytes32 builder` field in the signed EIP-712 Order struct. Any order routed through a builder code earns that builder a fee share on every fill. On-chain, programmable revenue share.
- Same primitive appears in Hyperliquid HIP-3 (`dex` parameter), Pump.fun (`BREAKING_FEE_RECIPIENT`), Ostium (`BuilderFee` struct), Avantis (referral codes).
- **Implication:** if we build an AI agent that recommends bets to users, and they place those bets through our app, we earn fees on-chain automatically. This is a monetization model that didn't exist a year ago.

---

## The arc-canteen CLI (already installed)

Installed via `uv tool install git+https://github.com/the-canteen-dev/ARC-cli.git`. Binary at `~/.local/bin/arc-canteen`.

### Key commands

| Command | What it does |
|---|---|
| `arc-canteen login` | Auth via GitHub, sets up an authenticated RPC URL (saved to `~/.arc-canteen/env` as `$RPC`) |
| `arc-canteen rpc <method> [params]` | JSON-RPC call to Arc testnet (e.g. `eth_blockNumber`, `eth_getBalance`, `eth_sendRawTransaction`). Method allowlist enforced. |
| `arc-canteen rpc-url` | Print the authenticated RPC URL |
| `arc-canteen shell-init >> ~/.zshrc` | Auto-load `$RPC` in every shell |
| `arc-canteen context sync` | Clones `the-canteen-dev/context-arc` into `~/.arc-canteen/context/` — docs + 5 sample codebases |
| `arc-canteen context` | Dumps `AGENTS.md` + paths to all docs/samples — pipe into LLMs: `arc-canteen context \| claude` |
| `arc-canteen update-product` / `update-traction` | Submit hackathon progress updates |
| `arc-canteen submit-puzzle` | Submit easter-egg puzzle answers |
| `arc-canteen rotate-rpc-key` | Rotate the RPC token (tokens valid 90 days) |

### Where things live locally
- `~/.arc-canteen/config.yaml` — auth token + profile
- `~/.arc-canteen/settings.yaml` — chain + event_name
- `~/.arc-canteen/env` — `export RPC='…'` for shell
- `~/.arc-canteen/context/` — synced docs + 5 sample codebases (this is the gold mine for understanding patterns)

### How to give yourself full context
```bash
arc-canteen context sync         # one-time sync of docs + samples
arc-canteen context --full       # dump everything inline
arc-canteen context --paths      # just file paths if context is large
```

When working on this project, **always read `~/.arc-canteen/context/AGENTS.md` first** and inspect the 5 sample codebases under `~/.arc-canteen/context/` before writing new code. Pattern-match from samples rather than inventing from scratch.

---

## What teammates and other hackers have already built (as of mid-event signals)

- **DealARC** (sharken) — AI-powered escrow on Arc + Circle USDC. Has agent API, MCP server, x402 enforcement. Live at deal-arc.vercel.app
- **jacks0n** — Most Circle tools wired up: Smart Contracts, USDC, Gateway, Dev-Controlled Wallets, x402 Nanopayments
- **hanhgia2212** — First live dashboard, auto-deployed on every push
- **CNote** — Adversarial cross-family pattern: Claude trader vs GPT auditor, anchored to ERC-8004 Identity + Validation Registries
- **0x77** — First to deploy, building the prediction-market layer itself
- **Artem00777** — Multi-wallet connect on Vercel
- **rickbest** — 7 separate demo flows in one toolkit

**Patterns emerging:** Next.js + Vercel for frontend, MCP servers for plugging into Claude/Cursor, x402 for agent micropayments, AI judge/auditor patterns for dispute resolution.

---

## RFB ideas being considered

1. **Trading-R1 / reasoning-as-product** — Hash the reasoning traces of an AI trader and pin them on-chain (IPFS for blob, hash on Arc). Bet on which reasoning patterns converge to profit.
2. **Hyperliquid Whale Index** — Arc-native ERC-20 that auto-rebalances USDC exposure across Hyperliquid forks based on whale migration. Weekly rebalances are cents on Arc.
3. **Slash-bonded copy-trading** — USDC performance bond on Arc for a whale; users stake alongside; bond slashes if leader falls below leaderboard threshold via oracle.
4. **Translation as alpha** — Market where agents bid in USDC to translate non-English news into Polymarket-shaped questions; builder fees flow to the translator on every fill.
5. **AI agent reads options data → bets on Polymarket** (Suchith's draft direction with teammate Yu) — Use options-implied volatility from Deribit/Lyra as a signal for prediction-market bets. Settle in USDC on Arc. Earn builder fees on every fill.

---

## How to work on this project

### When the user asks "what's possible / what should we build"
- Suggest concrete projects that match Suchith's strengths: multi-agent systems, MCP servers, RAG, FastAPI.
- Avoid pushing options-pricing or HFT-style work — neither teammate has the quant background for it in 2 weeks.
- Reference the 5 sample codebases in `~/.arc-canteen/context/` to ground suggestions in what's actually buildable on this stack.

### When writing code
1. **Read `~/.arc-canteen/context/AGENTS.md` first.** It's the canonical agent-facing guide.
2. **Look at the 5 sample codebases** in `~/.arc-canteen/context/` before inventing patterns.
3. **Use the `$RPC` env variable** (auto-loaded by `arc-canteen shell-init`) for any Web3 library — viem, ethers.js, web3.py.
4. For Solidity: use **Foundry** (preferred — `forge` for build/test/deploy/verify) or Hardhat.
5. For frontend: **Next.js + Vercel** is the path of least resistance (matches what other hackers are using).
6. For agent-side: **Python** with LangGraph + FastAPI matches Suchith's existing stack at 10xScale.ai.
7. **Always verify deployed contracts** on testnet.arcscan.app — opaque bytecode is a red flag.

### When explaining concepts
- Suchith is new to Web3 but is a strong engineer — explain mechanics, not magic.
- Map crypto concepts to familiar engineering concepts (smart contracts = serverless functions deployed to a public runtime, RPC = HTTP endpoint, etc.).
- He responds well to "here's the trade-off" framing, less well to hype.

### Coding posture
- Default to **small, testable, working examples** before larger architecture.
- Always show how to **run and verify** any code locally before deploying.
- Use **testnet only** (mainnet not in scope for the hackathon).
- Never paste real private keys; use Circle Wallets API or `.env` with `.gitignore` for dev keys.

---

## Project goals (in priority order for judging)

Per Canteen's stated rubric:
1. **30% Agentic sophistication** — the AI agent must actually do something non-trivial (multi-agent coordination, structured outputs, persistent decision logs, tool use).
2. **30% Traction** — real users / real on-chain transactions during the event window.
3. **20% Circle tool usage** — Wallets, Gateway, CCTP, App Kit, x402 — use as many as fit naturally.
4. **20% Innovation** — novel angle, not a clone of an existing protocol.

Plan accordingly — agent quality and live transactions matter more than complex DeFi math.

---

## Open questions to surface back to the user when relevant

- Final RFB pick (currently leaning toward prediction-market + AI agent direction)
- Whether teammate Yu's "crypto options data as signal" angle is still in scope
- Submission portal URL (not yet published; aadi mentioned it would appear in the event sidebar)
- Whether to build a public-facing demo (Vercel) or keep it CLI/MCP-only

Don't assume any of these are settled. Confirm with the user before locking in a direction.