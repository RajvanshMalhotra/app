"use client";
import { useEffect, useState } from "react";

/** The viewer's local date. Rendered in the browser so it is never the server's or the build's date. */
export function TodayDate() {
  const [date, setDate] = useState<string | null>(null);
  useEffect(() => {
    setDate(new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }));
  }, []);
  return <p className="mt-1 min-h-6 text-muted-foreground">{date}</p>;
}
