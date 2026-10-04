import { SessionClient } from "./session-client";
import { TodayDate } from "./today-date";

export const metadata = { title: "Today · Fundamentals" };

export default function TodayPage() {
  return (
    <section>
      <header className="mb-6">
        <h1 className="font-prompt text-3xl font-semibold tracking-tight md:text-4xl">Today</h1>
        <TodayDate />
      </header>
      <SessionClient />
    </section>
  );
}
