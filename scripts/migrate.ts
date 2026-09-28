import { pool } from "../src/lib/db";
import { runMigrations } from "../src/lib/migrations";

runMigrations(pool)
  .then((applied) => {
    console.log(applied.length ? `Applied: ${applied.join(", ")}` : "Database is up to date");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
