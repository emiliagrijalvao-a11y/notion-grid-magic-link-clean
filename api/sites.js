export default async function handler(req, res) {
  try {
    const { customer_id } = req.query;
    if (!customer_id || typeof customer_id !== "string") {
      return res.status(400).json({ error: "missing customer_id" });
    }

    const base = process.env.SUPABASE_URL;
    const key  = process.env.SUPABASE_SERVICE_ROLE;
    if (!base || !key) {
      return res.status(500).json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE" });
    }
    const headers = { apikey: key, Authorization: `Bearer ${key}` };

    const url =
      `${base}/rest/v1/sites` +
      `?customer_id=eq.${encodeURIComponent(customer_id)}` +
      `&select=id,notion_database_id,created_at` +
      `&order=created_at.desc`;

    const r = await fetch(url, { headers });
    const bodyText = await r.text();
    const data = r.ok ? (bodyText ? JSON.parse(bodyText) : []) : null;

    await fetch(`${base}/rest/v1/logs`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(
        r.ok
          ? { customer_id, event: "api-sites-ok",    detail: { count: Array.isArray(data) ? data.length : 0 } }
          : { customer_id, event: "api-sites-error", detail: { status: r.status, body: bodyText } }
      ),
    });

    if (!r.ok) return res.status(500).json({ error: "supabase error", status: r.status });
    return res.status(200).json(Array.isArray(data) ? data : []);
  } catch (e) {
    return res.status(500).json({ error: e?.message || "unknown error" });
  }
}
