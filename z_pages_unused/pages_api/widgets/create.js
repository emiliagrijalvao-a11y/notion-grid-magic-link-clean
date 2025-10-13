// api/widgets/create.js
export default async function handler(req, res) {
  // CORS básico (útil si haces fetch desde páginas estáticas)
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed" });
  }

  const { notion_database_id, customer_id } = req.body || {};
  if (!notion_database_id || !customer_id) {
    return res.status(400).json({ error: "missing fields" });
  }

  const base = process.env.SUPABASE_URL;
  const key  = process.env.SUPABASE_SERVICE_ROLE;
  if (!base || !key) {
    return res.status(500).json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE" });
  }
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation"
  };

  try {
    // Inserta el site
    const ins = await fetch(`${base}/rest/v1/sites`, {
      method: "POST",
      headers,
      body: JSON.stringify({ notion_database_id, customer_id })
    });
    const text = await ins.text();
    const data = ins.ok ? (text ? JSON.parse(text) : []) : null;

    // Log
    await fetch(`${base}/rest/v1/logs`, {
      method: "POST",
      headers,
      body: JSON.stringify(
        ins.ok
          ? { customer_id, event: "create-widget-ok",    detail: { notion_database_id } }
          : { customer_id, event: "create-widget-error", detail: { status: ins.status, body: text } }
      ),
    });

    if (!ins.ok) return res.status(500).json({ error: "supabase insert error", status: ins.status, body: text });
    // Devuelve la fila insertada
    return res.status(201).json(Array.isArray(data) ? data[0] : data);
  } catch (e) {
    return res.status(500).json({ error: e?.message || "unknown error" });
  }
}
