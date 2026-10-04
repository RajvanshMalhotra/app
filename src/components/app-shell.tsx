"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, CalendarCheck, Trophy } from "lucide-react";
import { SignOutButton } from "./sign-out-button";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { href: "/today", label: "Today", icon: CalendarCheck },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/leaderboard", label: "Ranks", icon: Trophy },
  { href: "/library", label: "Library", icon: BookOpen },
];

function Wordmark() {
  return <span className="font-prompt text-lg font-semibold tracking-tight">Fundamentals</span>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const current = (href: string) => (path.startsWith(href) ? "page" : undefined);
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-1 border-r border-sidebar-border bg-sidebar p-4 lg:flex">
        <div className="mb-6 px-3 pt-2"><Wordmark /></div>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={current(n.href)}
            className="flex h-11 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium aria-[current=page]:text-sidebar-accent-foreground">
            <n.icon className="size-4" />{n.label}
          </Link>
        ))}
        <div className="mt-auto flex items-center justify-between"><SignOutButton withLabel /><ThemeToggle /></div>
      </aside>

      <div className="min-w-0">
        <header className="flex h-14 items-center justify-between px-4 md:px-8 lg:hidden">
          <Wordmark />
          <div className="flex items-center"><ThemeToggle /><SignOutButton /></div>
        </header>
        <main className="mx-auto w-full max-w-3xl px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-2 md:px-8 lg:pb-12 lg:pt-10">
          {children}
        </main>
      </div>

      <nav aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={current(n.href)}
            className="flex h-16 flex-col items-center justify-center gap-1 text-xs text-muted-foreground aria-[current=page]:text-pen">
            <n.icon className="size-5" />{n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
