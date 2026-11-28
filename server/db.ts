import pg from "pg";
import { config } from "./config.js";

export const db = new pg.Pool({ connectionString: config.DATABASE_URL });
db.on("error", (error) => console.error("PostgreSQL pool error", error));
