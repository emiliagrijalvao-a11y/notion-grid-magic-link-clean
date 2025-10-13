export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const { notion_database_id, customer_id } = req.body || {};
  if (!notion_database_id || !customer_id) return res.status(400).json({ error: "missing fields" });

  try {
    const baseRaw = process.env.SUPABASE_URL || "";
    const baseNoSlash = baseRaw.replace(/\/+$/, "");
    const root = baseNoSlash.replace(/\/rest\/v1$/i, "");
    const REST = `${root}/rest/v1`;

    const key = process.env.SUPABASE_SERVICE_ROLE;
    if (!root || !key) return res.status(500).json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE" });

    const headers = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    };

    const ins = await fetch(`${REST}/sites`, {
      method: "POST",
      headers,
      body: JSON.stringify({ notion_database_id, customer_id })
    });
    const text = await ins.text();
    const data = ins.ok ? (text ? JSON.parse(text) : []) : null;

    await fetch(`${REST}/logs`, {
      method: "POST",
      headers,
      body: JSON.stringify(
        ins.ok ? { customer_id, event: "create-widget-ok",    detail: { notion_database_id } }
               : { customer_id, event: "create-widget-error", detail: { status: ins.status, body: text.slice(0,500) } }
      ),
    });

    if (!ins.ok) return res.status(500).json({ error: "supabase insert error", status: ins.status, body: text.slice(0,200) });
    return res.status(201).json(Array.isArray(data) ? data[0] : data);
  } catch (e) {
    return res.status(500).json({ error: e?.message || "unknown error" });
  }
}
