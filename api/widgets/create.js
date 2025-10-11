// api/widgets/create.js
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const BASE_URL = process.env.BASE_URL; // ej: https://notion-grid-magic-link-clean-git-main-flujo-creativo.vercel.app

function supa() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
}

function shortId(n = 6) {
  return Math.random().toString(36).slice(2, 2 + n);
}

// Extrae el ID de base de datos (32 hex) de una URL de Notion
function extractDbId(input) {
  if (!input) return null;
  const m = String(input).match(/[0-9a-f]{32}/i);
  return m ? m[0] : null;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
    const { email, notionToken, databaseUrl, name } = req.body || {};
    if (!email || !notionToken || !databaseUrl) {
      return res.status(400).json({ ok: false, error: "Faltan campos: email, notionToken, databaseUrl" });
    }

    const databaseId = extractDbId(databaseUrl);
    if (!databaseId) return res.status(400).json({ ok: false, error: "Database URL inválida" });

    const sb = supa();

    // 1) Asegura usuario
    await sb.from("fc_users").upsert({ email, name: name || null }, { onConflict: "email" });

    // 2) Determina plan por licencias activas
    let plan = "basic";
    const lic = await sb
      .from("fc_licenses")
      .select("*")
      .eq("email", email)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lic.data && lic.data.plan === "pro") plan = "pro";

    // 3) Crea widget
    const id = shortId(6);
    const insert = await sb.from("fc_widgets").insert({
      id,
      email,
      database_id: databaseId,
      notion_token: notionToken,
      plan,
    });

    if (insert.error) throw insert.error;

    const widgetUrl = `${BASE_URL}/widget/?id=${id}`;
    return res.status(200).json({ ok: true, id, plan, widgetUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
