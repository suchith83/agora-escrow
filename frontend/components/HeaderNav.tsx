"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/useSession";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function HeaderNav() {
  const { user, loading } = useSession();
  const router = useRouter();

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="flex items-center gap-4 text-sm">
      <Link href="/escrow/new" className="hover:underline">
        New escrow
      </Link>
      <Link href="/explore" className="hover:underline">
        Explore
      </Link>
      <Link href="/dashboard" className="hover:underline">
        Dashboard
      </Link>
      {loading ? null : user ? (
        <>
          <span className="text-mute text-xs hidden sm:inline">{user.email}</span>
          <button onClick={signOut} className="btn-outline py-1 px-3 text-xs">
            Sign out
          </button>
        </>
      ) : (
        <Link href="/login" className="btn-primary py-1 px-3 text-xs">
          Sign in
        </Link>
      )}
    </nav>
  );
}
