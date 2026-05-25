"use client";

import CopyableAddress from "./CopyableAddress";

interface TopUpGuideProps {
  walletAddress: string;
  className?: string;
}

export default function TopUpGuide({ walletAddress, className = "" }: TopUpGuideProps) {
  return (
    <div className={`rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-3 ${className}`}>
      <div className="text-sm font-semibold text-amber-900 flex items-center gap-2">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        Top up your wallet with testnet USDC
      </div>

      <ol className="text-sm text-amber-900/80 space-y-2 list-decimal list-inside">
        <li>
          Copy your wallet address below
        </li>
        <li>
          Open{" "}
          <a
            href="https://faucet.circle.com"
            target="_blank"
            rel="noreferrer"
            className="text-accent font-medium underline underline-offset-2 hover:text-accent/80"
          >
            faucet.circle.com
          </a>
        </li>
        <li>Paste your wallet address in the input field</li>
        <li>Select <strong>Arc Testnet</strong> as the network</li>
        <li>Click <strong>&quot;Send 20 USDC&quot;</strong> — it arrives in seconds</li>
      </ol>

      <CopyableAddress address={walletAddress} label="Your wallet address" />
    </div>
  );
}
