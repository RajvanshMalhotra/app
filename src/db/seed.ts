import { db } from "./client";
import { seedStarterContent } from "./seed-lib";

seedStarterContent(db, console.log).then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
