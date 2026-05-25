"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Suggestion {
  email: string;
  display_name: string | null;
}

interface SellerComboboxProps {
  value: string;
  onChange: (v: string) => void;
  suggestions: Suggestion[];
  placeholder?: string;
  excludeEmail?: string;
}

export function SellerCombobox({
  value,
  onChange,
  suggestions,
  placeholder,
  excludeEmail,
}: SellerComboboxProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = suggestions
    .filter((s) => s.email !== excludeEmail)
    .filter((s) => {
      const q = value.trim().toLowerCase();
      if (!q) return true;
      return (
        s.email.toLowerCase().includes(q) ||
        (s.display_name?.toLowerCase().includes(q) ?? false)
      );
    })
    .slice(0, 8);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    setHighlight(0);
  }, [value, open]);

  function select(s: Suggestion) {
    onChange(s.email);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (open && filtered[highlight]) {
        e.preventDefault();
        select(filtered[highlight]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="email"
        required
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
      />
      {open && filtered.length > 0 && (
        <div
          className="absolute z-20 mt-1 w-full rounded-md border border-line bg-white shadow-sm max-h-64 overflow-auto"
          role="listbox"
        >
          {filtered.map((s, i) => (
            <button
              key={s.email}
              type="button"
              role="option"
              aria-selected={i === highlight}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                select(s);
              }}
              className={cn(
                "w-full text-left px-3 py-2 text-sm flex flex-col gap-0.5 border-b border-line/60 last:border-b-0",
                i === highlight ? "bg-line/40" : "bg-white hover:bg-line/30"
              )}
            >
              <span className="text-ink truncate">{s.email}</span>
              {s.display_name && (
                <span className="text-xs text-mute truncate">{s.display_name}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
