// /api/user/account.js
import { supabase } from "./_supabase.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method Not Allowed" });

  try {
    const email = (req.query.email || "").toString().trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, error: "Falta email" });

    // asegurar user
    await supabase.from("fc_users").upsert({ email }, { onConflict: "email" });

    const { data: user } = await supabase.from("fc_users").select("*").eq("email", email).maybeSingle();
    const { data: licenses } = await supabase.from("fc_licenses").select("*").eq("user_email", email).order("issued_at", { ascending: false });
    const { data: widgets } = await supabase.from("fc_widgets").select("*").eq("user_email", email).order("created_at", { ascending: false });

    const out = {
      email,
      name: user?.name || null,
      accountType: user?.plan || "basic",
      licenses: (licenses || []).map(l => ({
        type: l.type === "pro" ? "Pro" : "Basic",
        key: l.license_key || null,
        date: new Date(l.issued_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      })),
      widgets: (widgets || []).map(w => ({
        id: w.short_id,
        token: w.token_mask || null,
        databaseId: w.database_id || null,
        url: w.widget_url || null
      }))
    };

    return res.json(out);
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
