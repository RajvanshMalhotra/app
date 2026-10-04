/**
 * The dev-login provider signs anyone in as any email, so it needs an explicit
 * ENABLE_DEV_LOGIN=1 and is never available in a production build.
 */
export function devLoginAllowed(env: Record<string, string | undefined>): boolean {
  return env.NODE_ENV !== "production" && env.ENABLE_DEV_LOGIN === "1";
}
