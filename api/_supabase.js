// /api/_supabase.js
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE;
const schema = process.env.SUPABASE_SCHEMA || "public";

if (!url || !serviceRole) {
  throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE");
}

export const supabase = createClient(url, serviceRole, {
  db: { schema },
  auth: { persistSession: false },
});
