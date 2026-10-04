"use client";
import { useSyncExternalStore } from "react";

const noSubscription = () => () => {};
const localDate = () => new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

/** The viewer's local date. Rendered in the browser so it is never the server's or the build's date. */
export function TodayDate() {
  const date = useSyncExternalStore(noSubscription, localDate, () => null);
  return <p className="mt-1 min-h-6 text-muted-foreground">{date}</p>;
}
