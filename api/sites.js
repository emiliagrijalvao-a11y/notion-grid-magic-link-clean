export default async function handler(req, res) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const { customer_id } = req.query;
    if (!customer_id || typeof customer_id !== "string") {
      return res.status(400).json({ error: "missing customer_id" });
    }
    const baseRaw = process.env.SUPABASE_URL || "";
    const baseNoSlash = baseRaw.replace(/\/+$/, "");
    const root = baseNoSlash.replace(/\/rest\/v1$/i, "");
    const REST = `${root}/rest/v1`;
    const key = process.env.SUPABASE_SERVICE_ROLE;
    if (!root || !key) return res.status(500).json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE" });

    const headers = { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" };
    const url = `${REST}/sites?customer_id=eq.${encodeURIComponent(customer_id)}&select=id,notion_database_id,created_at&order=created_at.desc`;
    const r = await fetch(url, { headers, cache: "no-store" });
    const text = await r.text();
    const data = r.ok && text ? JSON.parse(text) : null;

    // log
    await fetch(`${REST}/logs`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(
        r.ok ? { customer_id, event: "api-sites-ok", detail: { count: Array.isArray(data) ? data.length : 0 } }
            : { customer_id, event: "api-sites-error", detail: { status: r.status, body: text.slice(0, 500) } }
      ),
    });

    if (!r.ok) return res.status(500).json({ error: "supabase error", status: r.status, body: text.slice(0, 200) });
    return res.status(200).json(Array.isArray(data) ? data : []);
  } catch (e) {
    return res.status(500).json({ error: e?.message || "unknown error" });
  }
}
