import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { requireDatabaseUrl } from "../config/env.js";
import * as schema from "./schema.js";

const sql = neon(requireDatabaseUrl());

export const db = drizzle({ client: sql, schema });
