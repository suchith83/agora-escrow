"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Live count of people connected to a Supabase Realtime presence channel.
 *
 * Returns 0 until the channel is subscribed. Each browser tab counts as one.
 * The count drops automatically when a tab closes (the underlying socket
 * disconnect triggers a presence 'leave' broadcast to every other client).
 */
export function usePresence(channelName = "lobby"): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const sessionId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);

    const channel = supabase.channel(channelName, {
      config: { presence: { key: sessionId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        setCount(Object.keys(channel.presenceState()).length);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ at: Date.now() });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [channelName]);

  return count;
}
