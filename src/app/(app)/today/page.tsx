import { SessionClient } from "./session-client";

export const metadata = { title: "Today · Fundamentals" };

export default function TodayPage() {
  const date = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  return (
    <section>
      <header className="mb-6">
        <h1 className="font-prompt text-3xl font-semibold tracking-tight md:text-4xl">Today</h1>
        <p className="mt-1 text-muted-foreground">{date}</p>
      </header>
      <SessionClient />
    </section>
  );
}
