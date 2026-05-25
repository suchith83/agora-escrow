"use client";

import { useState, useCallback } from "react";

interface CopyableAddressProps {
  address: string;
  label?: string;
  className?: string;
}

export default function CopyableAddress({ address, label, className = "" }: CopyableAddressProps) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement("textarea");
      el.value = address;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [address]);

  return (
    <div className={className}>
      {label && <div className="text-xs text-mute mb-1">{label}</div>}
      <button
        type="button"
        onClick={copy}
        className="group flex items-center gap-2 w-full text-left bg-line/30 hover:bg-line/50 border border-line rounded-lg px-3 py-2 transition-colors"
      >
        <code className="text-xs break-all flex-1 select-all">{address}</code>
        <span className="shrink-0 text-mute group-hover:text-ink transition-colors" title="Copy to clipboard">
          {copied ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </span>
        {copied && <span className="text-xs text-green-600 font-medium shrink-0">Copied!</span>}
      </button>
    </div>
  );
}
