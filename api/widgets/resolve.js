// api/widgets/resolve.js
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";
const sb = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });

export default async function handler(req, res) {
  try {
    const id = req.query.id;
    if (!id) return res.status(400).json({ ok: false, error: "Falta id" });

    const r = await sb().from("fc_widgets").select("id,database_id,plan").eq("id", id).maybeSingle();
    if (r.error) throw r.error;
    if (!r.data) return res.status(404).json({ ok: false, error: "Widget no encontrado" });

    return res.status(200).json({ ok: true, id: r.data.id, databaseId: r.data.database_id, plan: r.data.plan });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
