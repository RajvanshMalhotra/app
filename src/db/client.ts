import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
const url = process.env.VITEST ? process.env.TEST_DATABASE_URL! : process.env.DATABASE_URL!;
export const db = drizzle(postgres(url), { schema });
