import { devLoginEnabled, emailEnabled, googleEnabled, signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const metadata = { title: "Sign in · Fundamentals" };

export default function SignIn() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 pb-[env(safe-area-inset-bottom)]">
      <div className="sheet w-full max-w-md overflow-hidden rounded-2xl border shadow-[0_12px_32px_-18px_rgb(27_34_48/0.35)]">
        <div className="space-y-6 py-10 pl-14 pr-6 md:pl-20 md:pr-10">
          <div>
            <h1 className="font-prompt text-3xl font-semibold tracking-tight">Fundamentals</h1>
            <p className="mt-2 text-muted-foreground">A few minutes a day to keep the basics sharp.</p>
          </div>

          {googleEnabled && (
            <form action={async () => { "use server"; await signIn("google", { redirectTo: "/today" }); }}>
              <Button className="h-11 w-full">Continue with Google</Button>
            </form>
          )}

          {emailEnabled && (
            <form className="space-y-2" action={async (f) => {
              "use server";
              await signIn("nodemailer", { email: String(f.get("email")), redirectTo: "/today" });
            }}>
              <Input name="email" type="email" required autoComplete="email" placeholder="you@example.com" aria-label="Email" className="h-11 bg-card" />
              <Button variant="outline" className="h-11 w-full bg-card">Email me a sign-in link</Button>
            </form>
          )}

          {devLoginEnabled && (
            <form className="space-y-2 border-t pt-6" action={async (f) => {
              "use server";
              await signIn("dev-login", { email: String(f.get("email")), redirectTo: "/today" });
            }}>
              <p className="text-sm text-muted-foreground">Development sign-in (disabled in production)</p>
              <Input name="email" aria-label="dev email" defaultValue="dev@local.test" className="h-11 bg-card" />
              <Button variant="secondary" className="h-11 w-full">Dev login</Button>
            </form>
          )}

          {!googleEnabled && !emailEnabled && !devLoginEnabled && (
            <p role="alert" className="text-sm text-mark-wrong">
              No sign-in method is configured. Set AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET, or EMAIL_SERVER, then restart.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
