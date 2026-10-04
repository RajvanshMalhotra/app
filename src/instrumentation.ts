// Runs once when the server starts, before it accepts requests.
// In the container (MIGRATE_ON_START=1) this applies database migrations and seeds starter cards.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.MIGRATE_ON_START !== "1") return;
  const { migrateAndSeed } = await import("./db/startup");
  await migrateAndSeed();
}
