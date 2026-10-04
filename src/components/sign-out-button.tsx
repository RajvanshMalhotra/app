"use client";
import { LogOut } from "lucide-react";
import { useTransition } from "react";
import { signOutAction } from "@/app/actions";

/** Deletes the offline copies of this user's pages and session before signing out, for shared devices. */
async function clearOfflineCaches() {
  if (!("caches" in window)) return;
  try {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("pages-")).map((k) => caches.delete(k)));
  } catch {
    // Cache storage can be unavailable (private mode); signing out still proceeds.
  }
}

export function SignOutButton({ withLabel = false }: { withLabel?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" aria-label="Sign out" title="Sign out" disabled={pending}
      onClick={() => start(async () => { await clearOfflineCaches(); await signOutAction(); })}
      className={`inline-flex h-11 items-center gap-3 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 ${withLabel ? "px-3" : "w-11 justify-center"}`}>
      <LogOut className="size-4" />
      {withLabel && "Sign out"}
    </button>
  );
}
