// Local Postgres 16 for development and tests, without Docker.
// Same credentials and port as docker-compose.yml, data kept in .data/pg.
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";

const dir = ".data/pg";
const pg = new EmbeddedPostgres({ databaseDir: dir, user: "app", password: "app", port: 5432, persistent: true });

if (!existsSync(`${dir}/PG_VERSION`)) await pg.initialise();
await pg.start();
for (const name of ["app", "app_test"]) {
  try { await pg.createDatabase(name); } catch { /* already exists */ }
}
console.log("Postgres ready on postgres://app:app@localhost:5432 (databases: app, app_test)");

const stop = async () => { await pg.stop(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
