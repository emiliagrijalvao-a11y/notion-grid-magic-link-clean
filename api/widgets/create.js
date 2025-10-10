// /api/widgets/create.js
import { supabase } from "./_supabase.js";

function shortId() {
  return Math.random().toString(36).slice(2, 8);
}
function maskToken(tok = "") {
  if (!tok) return "—";
  if (tok.length < 8) return "••••";
  return `${tok.slice(0,4)}••••${tok.slice(-4)}`;
}
function extractDbIdFromUrl(url = "") {
  const m = url.match(/[0-9a-f]{32}/i);
  return m ? m[0] : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method Not Allowed" });

  try {
    const { email, notionToken, databaseUrl } = req.body || {};
    if (!email || !notionToken || !databaseUrl) {
      return res.status(400).json({ success: false, error: "Faltan campos (email, notionToken, databaseUrl)" });
    }

    const BASE_URL = process.env.BASE_URL;
    if (!BASE_URL) return res.status(500).json({ success: false, error: "Falta BASE_URL" });

    const sid = shortId();
    const widgetUrl = `${BASE_URL}/widget/${sid}`;
    const dbId = extractDbIdFromUrl(databaseUrl) || databaseUrl;

    await supabase.from("fc_users").upsert({ email: email.toLowerCase() }, { onConflict: "email" });

    const { error } = await supabase.from("fc_widgets").insert({
      short_id: sid,
      user_email: email.toLowerCase(),
      database_id: dbId,
      widget_url: widgetUrl,
      token_mask: maskToken(notionToken)
    });
    if (error) throw error;

    return res.json({ success: true, widgetUrl, shortId: sid });
  } catch (err) {
    return res.status(500).json({ success: false, error: String(err) });
  }
}
